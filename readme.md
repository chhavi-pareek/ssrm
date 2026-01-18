# Supplier Risk & Relationship Management (SRRM)

## Overview

The **Supplier Risk & Relationship Management (SRRM)** system is an end-to-end data and ML-driven platform designed to assess, predict, and explain supplier risk. It integrates structured supplier data, machine learning predictions, workflow orchestration, and an interactive frontend dashboard.

The system is built to demonstrate a real-world enterprise analytics pipeline, including explainable AI (XAI) using SHAP.

Additionally, the system integrates **Camunda BPM** to automatically trigger business workflows (ticket creation and notifications) when **High Risk** suppliers are detected.


---

## High-Level Project Flow

1. **Supplier & Risk Data Ingestion**

   * Supplier metadata is stored in `supplier_profile`
   * Periodic operational and risk metrics are stored in `supplier_risk_master`
   * Newly added records are marked with `is_predicted = false`

2. **Prediction Pipeline (Apache Airflow)**

   * An Airflow DAG fetches only unpredicted rows
   * A trained **LightGBM model** predicts supplier risk
   * Outputs are written to:

     * `risk_prediction_history` (predictions + probabilities)
     * `shap_explanations` (feature-level explanations)
   * Processed rows are marked as `is_predicted = true`
     
3. Workflow Automation (Camunda BPM)
* If any supplier is predicted as **High Risk**:
  * Airflow triggers a Camunda BPMN process
  * Camunda executes:
    - Ticket creation task
    - Notification sending task
  * Both tasks are handled by **Python External Task Workers**
  * Workers write execution events to:
    - `workflow_events` table in Supabase
      

3. **Explainability**

   * SHAP values explain **why** a supplier was classified as high/medium/low risk
   * Stored as JSON for flexible visualization

4. **Frontend Dashboard**

   * Built using **Streamlit**
   * Allows users to:

     * View all tables
     * Upload new CSV data
     * Trigger the Airflow DAG
     * Analyze predictions and SHAP explanations
     * Identify high-risk suppliers
     *  View workflow actions:
       *Ticket Created
       *Notification Sent

---

## System Architecture (Logical)

```
CSV / UI Input
      ↓
Supabase (PostgreSQL)
      ↓
Apache Airflow DAG
      ↓
LightGBM + SHAP
      ↓
Predictions + Explanations
      ↓
If High Risk:
      ↓
Camunda BPM
      ↓
External Task Workers
      ↓
workflow_events (Supabase)
      ↓
Streamlit Dashboard
```

---

## Tech Stack

* **Database:** Supabase (PostgreSQL)
* **ML Model:** LightGBM
* **Explainability:** SHAP
* **Orchestration:** Apache Airflow
* **Workflow Engine:** Camunda BPM
* **Backend Access:** Supabase Python Client
* **Frontend:** Streamlit
* **Language:** Python 3.10

---

## Repository Structure

```
srrm_system/
│
├── airflow/
│ ├── dags/
│ │ └── srrm_prediction_dag.py
│ └── models/
│ ├── lgbm_model.txt
│ ├── preprocessors.pkl
│ ├── feature_names.json
│ └── model_metadata.json
│
├── frontend/
│ └── app.py
│
├── camunda/
│ ├── srrm_ticket_workflow.bpmn
│ ├── worker_create_ticket.py
│ └── worker_send_notification.py
│
├── airflow_venv/
│
└── .env
```


---

## Local Setup Instructions

### 1. Prerequisites

* Python **3.10**
* Supabase project (tables already created)
* Airflow 2.8.x
* macOS / Linux recommended
* Docker (for Camunda)

---

### 2. Clone / Create Project Directory

```bash
mkdir srrm_system
cd srrm_system
```

---

### 3. Create Virtual Environment

```bash
python3.10 -m venv airflow_venv
source airflow_venv/bin/activate
```

---

### 4. Install Dependencies

```bash
pip install apache-airflow==2.8.1 \
            lightgbm \
            shap \
            pandas \
            joblib \
            supabase \
            streamlit \
            python-dotenv \
            requests
```

---

### 5. Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

AIRFLOW_API=http://localhost:8080/api/v1
AIRFLOW_USER=admin
AIRFLOW_PASS=admin
```

Load them before running:

```bash
export $(cat .env | xargs)
```

---

### 6. Initialize Airflow

```bash
export AIRFLOW_HOME=$(pwd)/airflow
airflow db init
airflow users create \
  --username admin \
  --firstname admin \
  --lastname admin \
  --role Admin \
  --email admin@example.com \
  --password admin
```

---

### 7. Start Airflow

In **two terminals**:

**Terminal 1**

```bash
airflow webserver --port 8080
```

**Terminal 2**

```bash
airflow scheduler
```

Access Airflow UI at:
👉 [http://localhost:8080](http://localhost:8080)

---

### 8. Place Model Artifacts

Ensure the following files exist:

```
airflow/models/
├── lgbm_model.txt
├── preprocessors.pkl
├── feature_names.json
├── model_metadata.json
```

---
### 10. Camunda Setup(using docker)

**Terminal 3**

```bash
docker run -d -p 8081:8080 camunda/camunda-bpm-platform:run-latest
```
Camunda UI:
 http://localhost:8081/camunda

**Deploy BPMN workflow**

File:
```bash
camunda/srrm_ticket_workflow.bpmn
```
Open in Camunda Modeler and click Deploy to:
```bash
http://localhost:8081/engine-rest
```
Process:Start → Create Ticket (External Task) → Send Notification (External Task) → End

**Start External Task Workers**
**Terminal 4**

```bash
cd camunda
python worker_create_ticket.py
```
**Terminal 5**

```bash
cd camunda
python worker_send_notification.py
```

### 10. Run Frontend

```bash
cd frontend
streamlit run app.py
```

Access UI at:
👉 [http://localhost:8501](http://localhost:8501)

---

## How to Use the System

1. Upload supplier risk data via the frontend (CSV)
2. Click **Run Prediction Pipeline**
3. Airflow triggers the DAG
4. Predictions and SHAP explanations are generated
5. If any supplier is High Risk:Airflow triggers Camunda workflow
6. View results and high-risk suppliers in the dashboard

---


