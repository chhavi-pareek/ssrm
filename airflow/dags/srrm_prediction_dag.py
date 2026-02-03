from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
import os
import json
import pandas as pd
import joblib
import lightgbm as lgb
import shap
import requests
from supabase import create_client

# ------------------------------------------------------------------
# AIRFLOW-CONTRACT SAFE PATHS
# ------------------------------------------------------------------

AIRFLOW_HOME = os.environ.get("AIRFLOW_HOME", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

MODEL_DIR = os.path.join(AIRFLOW_HOME, "models")
DAGS_DIR = os.path.join(AIRFLOW_HOME, "dags")

MODEL_PATH = os.path.join(MODEL_DIR, "lgbm_model.txt")
PREPROCESSOR_PATH = os.path.join(MODEL_DIR, "preprocessors.pkl")
FEATURES_PATH = os.path.join(MODEL_DIR, "feature_names.json")
MODEL_METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.json")

# Validate files early (fail fast)
for path in [
    MODEL_PATH,
    PREPROCESSOR_PATH,
    FEATURES_PATH,
    MODEL_METADATA_PATH,
]:
    if not os.path.exists(path):
        raise FileNotFoundError(f"❌ Required file missing: {path}")

# ------------------------------------------------------------------
# SUPABASE
# ------------------------------------------------------------------

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ------------------------------------------------------------------
# TASKS
# ------------------------------------------------------------------

def fetch_supplier_data(**context):
    """
    Fetch only rows that have not been predicted yet (is_predicted = False or NULL)
    """
    response = (
        supabase
        .table("supplier_risk_master")
        .select("*")
        .or_("is_predicted.eq.false,is_predicted.is.null")
        .execute()
    )

    df = pd.DataFrame(response.data)

    if df.empty:
        print("✅ No new rows to predict")
        return

    tmp_path = os.path.join(AIRFLOW_HOME, "tmp_supplier_data.pkl")
    df.to_pickle(tmp_path)

    context["ti"].xcom_push(key="data_path", value=tmp_path)


def preprocess_and_predict(**context):
    data_path = context["ti"].xcom_pull(key="data_path")
    if not data_path:
        print("✅ Nothing to process")
        return

    df = pd.read_pickle(data_path)
    print(f"Processing {len(df)} rows")
    
    # Store original dataframe for later use
    df_original = df.copy()

    # ---------------- Load model ----------------
    model = lgb.Booster(model_file=MODEL_PATH)

    preprocessors = joblib.load(PREPROCESSOR_PATH)
    label_encoders = preprocessors["label_encoders"]

    with open(FEATURES_PATH) as f:
        feature_names = json.load(f)["features"]

    # ---------------- Encode categoricals ----------------
    df["industry_segment_enc"] = label_encoders["industry_segment"].transform(
        df["industry_segment"]
    )
    df["supplier_size_enc"] = label_encoders["supplier_size"].transform(
        df["supplier_size"]
    )

    X = df[feature_names]
    
    print(f"Feature matrix shape: {X.shape}")

    # ---------------- Predict ----------------
    probs = model.predict(X)
    pred_class_idx = probs.argmax(axis=1)

    risk_encoder = label_encoders["risk_category"]
    pred_labels = risk_encoder.inverse_transform(pred_class_idx)

    # ---------------- SHAP ----------------
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)
    
    # Debug: Check SHAP values structure
    print(f"SHAP values type: {type(shap_values)}")
    if isinstance(shap_values, list):
        print(f"SHAP values has {len(shap_values)} classes")
        print(f"Each class has shape: {[sv.shape for sv in shap_values]}")
    else:
        print(f"SHAP values shape: {shap_values.shape}")

    n_rows = len(df_original)
    today = datetime.utcnow().date()

    with open(MODEL_METADATA_PATH) as f:
        model_version = json.load(f).get("model_version", "v1.0")

    print(f"Storing results for {n_rows} predictions")

    # ---------------- Store results ----------------
    for pos in range(n_rows):
        row = df_original.iloc[pos]
        class_idx = pred_class_idx[pos]

        supabase.table("risk_prediction_history").insert({
            "supplier_id": row["supplier_id"],
            "date": str(row["date"]),
            "predicted_risk": pred_labels[pos],
            "prob_high": float(probs[pos][0]),
            "prob_medium": float(probs[pos][1]),
            "prob_low": float(probs[pos][2]),
            "model_version": model_version,
            "prediction_date": datetime.utcnow().isoformat()
        }).execute()
        
        # 🚨 If HIGH risk → trigger Camunda
        if pred_labels[pos] == "High Risk":
            print("🚨 HIGH RISK DETECTED — Triggering Camunda workflow")
            trigger_camunda_workflow(str(row["supplier_id"]))

        # SHAP values shape: (n_samples, n_features, n_classes)
        # Get SHAP values for sample pos, all features, predicted class
        shap_for_class = shap_values[pos, :, int(class_idx)]
        shap_payload = dict(zip(feature_names, shap_for_class.tolist()))

        supabase.table("shap_explanations").insert({
            "supplier_id": row["supplier_id"],
            "prediction_date": today.isoformat(),
            "shap_values": shap_payload
        }).execute()

        supabase.table("supplier_risk_master").update(
            {"is_predicted": True}
        ).eq("supplier_id", row["supplier_id"]) \
         .eq("date", row["date"]) \
         .execute()
    
    print(f"✅ Successfully processed {n_rows} predictions")
         
def trigger_camunda_workflow(supplier_name):
    url = "http://localhost:8081/engine-rest/process-definition/key/Process_1cpixyy/start"

    payload = {
        "variables": {
            "supplier": {
                "value": supplier_name,
                "type": "String"
            }
        }
    }

    try:
        r = requests.post(url, json=payload, timeout=5)
        print("🔥 Camunda triggered:", r.status_code, r.text)
    except Exception as e:
        print("❌ Failed to trigger Camunda:", e)


# ------------------------------------------------------------------
# DAG
# ------------------------------------------------------------------

with DAG(
    dag_id="srrm_prediction_dag",
    start_date=datetime(2024, 1, 1),
    schedule_interval=None,
    catchup=False,
    tags=["srrm", "prediction"]
) as dag:

    fetch_data = PythonOperator(
        task_id="fetch_supplier_data",
        python_callable=fetch_supplier_data
    )

    predict = PythonOperator(
        task_id="preprocess_and_predict",
        python_callable=preprocess_and_predict
    )

    fetch_data >> predict
