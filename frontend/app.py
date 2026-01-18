"""
Supplier Risk & Relationship Management (SRRM) System
Frontend Dashboard built with Streamlit

Features:
- Overview KPIs and high-risk suppliers
- Supplier Risk Master data browser with filters
- Prediction history viewer
- SHAP explainability visualizations
- CSV upload and Airflow DAG triggering
"""

import streamlit as st
import pandas as pd
import requests
import os
import json
import time
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

# ==============================================================================
# CONFIGURATION & INITIALIZATION
# ==============================================================================

load_dotenv()

# Load environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
AIRFLOW_API = os.getenv("AIRFLOW_API", "http://localhost:8080/api/v1")
AIRFLOW_USER = os.getenv("AIRFLOW_USER", "admin")
AIRFLOW_PASS = os.getenv("AIRFLOW_PASS", "admin")

# Validate environment variables
if not SUPABASE_URL or not SUPABASE_KEY:
    st.error("⚠️ Missing Supabase credentials in .env file")
    st.stop()

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==============================================================================
# PAGE CONFIGURATION
# ==============================================================================

st.set_page_config(
    page_title="SRRM Dashboard",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for professional styling
st.markdown("""
    <style>
    .main-header {
        font-size: 2.5rem;
        font-weight: 700;
        color: #1f77b4;
        margin-bottom: 0.5rem;
    }
    .kpi-card {
        background-color: #f0f2f6;
        padding: 1.5rem;
        border-radius: 0.5rem;
        border-left: 4px solid #1f77b4;
    }
    .kpi-value {
        font-size: 2rem;
        font-weight: 700;
        color: #1f77b4;
    }
    .kpi-label {
        font-size: 0.9rem;
        color: #666;
        text-transform: uppercase;
    }
    </style>
""", unsafe_allow_html=True)

st.markdown('<div class="main-header">🏭 Supplier Risk & Relationship Management</div>', unsafe_allow_html=True)
st.markdown("**Enterprise-grade supplier risk analytics and prediction platform**")
st.divider()

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

@st.cache_data(ttl=60)
def fetch_supplier_risk_master():
    """Fetch all supplier risk master records"""
    try:
        response = supabase.table("supplier_risk_master")\
            .select("*")\
            .order("date", desc=True)\
            .execute()
        return pd.DataFrame(response.data) if response.data else pd.DataFrame()
    except Exception as e:
        st.error(f"Error fetching supplier risk master: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_risk_predictions():
    """Fetch all risk predictions"""
    try:
        response = supabase.table("risk_prediction_history")\
            .select("*")\
            .order("prediction_date", desc=True)\
            .execute()
        return pd.DataFrame(response.data) if response.data else pd.DataFrame()
    except Exception as e:
        st.error(f"Error fetching predictions: {e}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def fetch_shap_explanations():
    """Fetch all SHAP explanations"""
    try:
        response = supabase.table("shap_explanations")\
            .select("*")\
            .order("prediction_date", desc=True)\
            .execute()
        return pd.DataFrame(response.data) if response.data else pd.DataFrame()
    except Exception as e:
        st.error(f"Error fetching SHAP data: {e}")
        return pd.DataFrame()


def fetch_workflow_events():
    try:
        response = supabase.table("workflow_events") \
            .select("*") \
            .order("created_at", desc=True) \
            .execute()
        return pd.DataFrame(response.data) if response.data else pd.DataFrame()
    except Exception as e:
        st.error(f"Error fetching workflow events: {e}")
        return pd.DataFrame()


def trigger_airflow_dag():
    """Trigger Airflow prediction DAG via REST API"""
    try:
        url = f"{AIRFLOW_API}/dags/srrm_prediction_dag/dagRuns"
        response = requests.post(
            url,
            auth=(AIRFLOW_USER, AIRFLOW_PASS),
            json={"conf": {"source": "frontend", "triggered_at": str(datetime.now())}},
            headers={"Content-Type": "application/json"}
        )
        return response.status_code == 200, response
    except Exception as e:
        return False, str(e)

def validate_csv_columns(df):
    """Validate CSV has required columns for supplier_risk_master"""
    required_cols = [
        'supplier_id', 'date', 'on_time_delivery_rate', 'quality_score',
        'geopolitical_risk_score', 'communication_score', 'annual_spending_rupees',
        'total_risk_score', 'risk_category', 'industry_segment', 'supplier_size'
    ]
    missing_cols = [col for col in required_cols if col not in df.columns]
    return len(missing_cols) == 0, missing_cols

# ==============================================================================
# TAB 1: 📈 OVERVIEW
# ==============================================================================

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "📈 Overview",
    "🏭 Supplier Risk Master",
    "🧠 Predictions",
    "🔍 SHAP Explanations",
    "📤 Upload & Predict",
    "🎫 Workflow Events"
])

with tab1:
    st.header("📈 System Overview")
    
    # Fetch data for KPIs
    risk_master_df = fetch_supplier_risk_master()
    predictions_df = fetch_risk_predictions()
    
    # Display KPIs
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        total_suppliers = risk_master_df['supplier_id'].nunique() if not risk_master_df.empty else 0
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-label">Total Suppliers</div>
            <div class="kpi-value">{total_suppliers}</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        total_predictions = len(predictions_df) if not predictions_df.empty else 0
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-label">Total Predictions</div>
            <div class="kpi-value">{total_predictions}</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        high_risk_count = len(predictions_df[predictions_df['predicted_risk'] == 'High']) if not predictions_df.empty else 0
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-label">High-Risk Suppliers</div>
            <div class="kpi-value" style="color: #d62728;">{high_risk_count}</div>
        </div>
        """, unsafe_allow_html=True)
    
    with col4:
        avg_high_prob = predictions_df['prob_high'].mean() if not predictions_df.empty and 'prob_high' in predictions_df.columns else 0
        st.markdown(f"""
        <div class="kpi-card">
            <div class="kpi-label">Avg High Risk Prob</div>
            <div class="kpi-value">{avg_high_prob:.2%}</div>
        </div>
        """, unsafe_allow_html=True)
    
    st.divider()
    
    # Top 10 High-Risk Suppliers
    st.subheader("🔴 Top 10 Highest Risk Suppliers")
    
    if not predictions_df.empty and 'prob_high' in predictions_df.columns:
        top_10_high_risk = predictions_df.nlargest(10, 'prob_high')[
            ['supplier_id', 'predicted_risk', 'prob_high', 'prob_medium', 'prob_low', 'prediction_date', 'model_version']
        ]
        
        # Format probabilities as percentages
        display_df = top_10_high_risk.copy()
        for col in ['prob_high', 'prob_medium', 'prob_low']:
            if col in display_df.columns:
                display_df[col] = display_df[col].apply(lambda x: f"{x:.2%}")
        
        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True
        )
        
        # Risk distribution chart
        st.subheader("📊 Risk Category Distribution")
        risk_counts = predictions_df['predicted_risk'].value_counts()
        st.bar_chart(risk_counts)
    else:
        st.info("No prediction data available yet. Upload data and run predictions to see results.")

# ==============================================================================
# TAB 2: 🏭 SUPPLIER RISK MASTER
# ==============================================================================

with tab2:
    st.header("🏭 Supplier Risk Master Data")
    st.markdown("Browse and filter supplier risk metrics")
    
    risk_master_df = fetch_supplier_risk_master()
    
    if not risk_master_df.empty:
        # Filters
        col1, col2, col3 = st.columns(3)
        
        with col1:
            supplier_ids = ['All'] + sorted(risk_master_df['supplier_id'].unique().tolist())
            selected_supplier = st.selectbox("Filter by Supplier ID", supplier_ids)
        
        with col2:
            risk_categories = ['All'] + sorted(risk_master_df['risk_category'].dropna().unique().tolist())
            selected_risk = st.selectbox("Filter by Risk Category", risk_categories)
        
        with col3:
            industry_segments = ['All'] + sorted(risk_master_df['industry_segment'].dropna().unique().tolist())
            selected_industry = st.selectbox("Filter by Industry Segment", industry_segments)
        
        # Apply filters
        filtered_df = risk_master_df.copy()
        
        if selected_supplier != 'All':
            filtered_df = filtered_df[filtered_df['supplier_id'] == selected_supplier]
        
        if selected_risk != 'All':
            filtered_df = filtered_df[filtered_df['risk_category'] == selected_risk]
        
        if selected_industry != 'All':
            filtered_df = filtered_df[filtered_df['industry_segment'] == selected_industry]
        
        st.info(f"Showing {len(filtered_df)} of {len(risk_master_df)} records")
        
        # Display filtered data
        st.dataframe(
            filtered_df,
            use_container_width=True,
            hide_index=True
        )
        
        # Export option
        csv = filtered_df.to_csv(index=False)
        st.download_button(
            label="📥 Download Filtered Data as CSV",
            data=csv,
            file_name=f"supplier_risk_master_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )
    else:
        st.warning("No supplier risk master data found. Upload data to get started.")

# ==============================================================================
# TAB 3: 🧠 PREDICTIONS
# ==============================================================================

with tab3:
    st.header("🧠 Risk Prediction History")
    st.markdown("View and analyze ML model predictions")
    
    predictions_df = fetch_risk_predictions()
    
    if not predictions_df.empty:
        # Sort options
        col1, col2 = st.columns(2)
        
        with col1:
            sort_by = st.selectbox(
                "Sort by",
                ['prediction_date', 'prob_high', 'prob_medium', 'prob_low'],
                index=0
            )
        
        with col2:
            sort_order = st.radio("Order", ['Descending', 'Ascending'], horizontal=True)
        
        # Apply sorting
        sorted_df = predictions_df.sort_values(
            by=sort_by,
            ascending=(sort_order == 'Ascending')
        )
        
        # Format display
        display_df = sorted_df.copy()
        for col in ['prob_high', 'prob_medium', 'prob_low']:
            if col in display_df.columns:
                display_df[col] = display_df[col].apply(lambda x: f"{x:.2%}" if pd.notnull(x) else "N/A")
        
        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True
        )
        
        # Statistics
        st.divider()
        st.subheader("📊 Prediction Statistics")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("High Risk Predictions", len(predictions_df[predictions_df['predicted_risk'] == 'High']))
        
        with col2:
            st.metric("Medium Risk Predictions", len(predictions_df[predictions_df['predicted_risk'] == 'Medium']))
        
        with col3:
            st.metric("Low Risk Predictions", len(predictions_df[predictions_df['predicted_risk'] == 'Low']))
        
    else:
        st.warning("No predictions found. Trigger the Airflow DAG to generate predictions.")

# ==============================================================================
# TAB 4: 🔍 SHAP EXPLANATIONS
# ==============================================================================

with tab4:
    st.header("🔍 SHAP Explainability")
    st.markdown("Understand model predictions with SHAP feature importance")
    
    shap_df = fetch_shap_explanations()
    
    if not shap_df.empty:
        # Supplier selection
        supplier_ids = sorted(shap_df['supplier_id'].unique().tolist())
        selected_supplier = st.selectbox(
            "Select Supplier to View SHAP Explanation",
            supplier_ids,
            key="shap_supplier_select"
        )
        
        if selected_supplier:
            # Get latest SHAP data for selected supplier
            supplier_shap = shap_df[shap_df['supplier_id'] == selected_supplier].sort_values(
                'prediction_date', ascending=False
            ).iloc[0]
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.metric("Supplier ID", selected_supplier)
            
            with col2:
                st.metric("Latest Prediction Date", str(supplier_shap['prediction_date']))
            
            st.divider()
            
            # Parse SHAP values
            try:
                shap_values = supplier_shap['shap_values']
                
                # Handle both string and dict types
                if isinstance(shap_values, str):
                    shap_dict = json.loads(shap_values)
                else:
                    shap_dict = shap_values
                
                if shap_dict:
                    # Create DataFrame for visualization
                    shap_features_df = pd.DataFrame(
                        list(shap_dict.items()),
                        columns=['Feature', 'SHAP Value']
                    )
                    shap_features_df = shap_features_df.sort_values('SHAP Value', ascending=False)
                    
                    # SHAP bar chart
                    st.subheader("📊 Feature Contribution to Risk Prediction")
                    st.bar_chart(
                        shap_features_df.set_index('Feature')['SHAP Value'],
                        use_container_width=True
                    )
                    
                    # Detailed table
                    st.subheader("📋 Detailed SHAP Values")
                    st.dataframe(
                        shap_features_df,
                        use_container_width=True,
                        hide_index=True
                    )
                    
                    # Interpretation
                    st.info("""
                    **How to interpret SHAP values:**
                    - Positive values increase the predicted risk
                    - Negative values decrease the predicted risk
                    - Larger absolute values indicate stronger feature influence
                    """)
                else:
                    st.warning("No SHAP values found for this supplier.")
            
            except Exception as e:
                st.error(f"Error parsing SHAP values: {e}")
    else:
        st.warning("No SHAP explanations found. Run predictions to generate SHAP values.")

# ==============================================================================
# TAB 5: 📤 UPLOAD & PREDICT
# ==============================================================================

with tab5:
    st.header("📤 Upload Data & Trigger Predictions")
    
    # Section 1: CSV Upload
    st.subheader("1️⃣ Upload Supplier Data")
    st.markdown("Upload a CSV file with supplier risk metrics. The file will be validated and inserted into the database.")
    
    uploaded_file = st.file_uploader(
        "Choose a CSV file",
        type="csv",
        help="CSV must contain all required columns for supplier_risk_master table"
    )
    
    if uploaded_file:
        try:
            df = pd.read_csv(uploaded_file)
            
            st.write("**Preview (first 10 rows):**")
            st.dataframe(df.head(10), use_container_width=True)
            
            # Validate columns
            is_valid, missing_cols = validate_csv_columns(df)
            
            if is_valid:
                st.success("✅ CSV validation passed!")
                
                col1, col2 = st.columns(2)
                
                with col1:
                    st.metric("Total Rows", len(df))
                
                with col2:
                    st.metric("Unique Suppliers", df['supplier_id'].nunique())
                
                # Upload button
                if st.button("📤 Upload to Database", type="primary"):
                    try:
                        # Set is_predicted to False for new data
                        df['is_predicted'] = False
                        
                        # Convert DataFrame to list of dicts
                        records = df.to_dict(orient='records')
                        
                        # Insert into Supabase
                        response = supabase.table("supplier_risk_master").insert(records).execute()
                        
                        st.success(f"✅ Successfully uploaded {len(records)} records to database!")
                        st.balloons()
                        
                        # Clear cache to refresh data
                        st.cache_data.clear()
                        
                    except Exception as e:
                        st.error(f"❌ Upload failed: {e}")
            else:
                st.error(f"❌ CSV validation failed. Missing columns: {', '.join(missing_cols)}")
                
                with st.expander("Show Required Columns"):
                    required_cols = [
                        'supplier_id', 'date', 'on_time_delivery_rate', 'quality_score',
                        'geopolitical_risk_score', 'communication_score', 'annual_spending_rupees',
                        'total_risk_score', 'risk_category', 'industry_segment', 'supplier_size'
                    ]
                    st.code('\n'.join(required_cols))
        
        except Exception as e:
            st.error(f"Error reading CSV: {e}")
    
    st.divider()
        
    # Section 2: Trigger Airflow DAG
    st.subheader("2️⃣ Trigger ML Prediction Pipeline")
    st.markdown("""
    Click the button below to trigger the Airflow DAG that will:
    1. Fetch all suppliers with `is_predicted = false`
    2. Run LightGBM risk prediction model
    3. Generate SHAP explanations
    4. Save results to `risk_prediction_history` and `shap_explanations` tables
    5. Update `is_predicted = true`
    """)
    
    # Show unpredicted records count
    risk_master_df = fetch_supplier_risk_master()
    if not risk_master_df.empty:
        unpredicted_count = len(risk_master_df[risk_master_df['is_predicted'] == False])
        
        if unpredicted_count > 0:
            st.warning(f"⚠️ {unpredicted_count} records pending prediction")
        else:
            st.info("✅ All records have been predicted")
    
    # Trigger button
    if st.button("🚀 Run Airflow Prediction DAG", type="primary"):
        with st.spinner("Triggering Airflow DAG..."):
            success, response = trigger_airflow_dag()
            
            if success:
                st.success("✅ Airflow DAG triggered successfully!")
                st.info("The prediction pipeline is now running. Check the Airflow UI for status.")
                
                # Show DAG run details if available
                try:
                    run_data = response.json()
                    with st.expander("Show DAG Run Details"):
                        st.json(run_data)
                except:
                    pass
                
                st.balloons()
            else:
                st.error(f"❌ Failed to trigger DAG: {response}")
                st.info(f"Make sure Airflow is running at: {AIRFLOW_API}")
    
    st.divider()
    
    # Section 3: System Status
    st.subheader("🔧 System Status")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("**Database Connection:**")
        try:
            # Test Supabase connection
            supabase.table("supplier_profile").select("supplier_id").limit(1).execute()
            st.success("✅ Connected to Supabase")
        except:
            st.error("❌ Supabase connection failed")
    
    with col2:
        st.markdown("**Airflow API:**")
        try:
            # Test Airflow connection
            resp = requests.get(
                f"{AIRFLOW_API}/health",
                auth=(AIRFLOW_USER, AIRFLOW_PASS),
                timeout=5
            )
            if resp.status_code == 200:
                st.success("✅ Airflow API reachable")
            else:
                st.warning(f"⚠️ Airflow API returned status {resp.status_code}")
        except:
            st.error("❌ Airflow API unreachable")
            
# ==============================================================================
# TAB 6: 🎫 WORKFLOW EVENTS (CAMUNDA OUTPUT)
# ==============================================================================

with tab6:
    st.header("🎫 Ticket & Notification Events")
    st.markdown("Shows actions executed by Camunda workers")

    events_df = fetch_workflow_events()

    if not events_df.empty:
        events_df["created_at"] = pd.to_datetime(events_df["created_at"])

        def format_event(e):
            if "ticket" in e:
                return "🎫 Ticket Created"
            elif "notification" in e:
                return "📢 Notification Sent"
            else:
                return e

        events_df["event_display"] = events_df["event_type"].apply(format_event)

        display_df = events_df[["supplier_id", "event_display", "created_at"]] \
            .rename(columns={
                "supplier_id": "Supplier",
                "event_display": "Event",
                "created_at": "Time"
            })

        st.dataframe(display_df, use_container_width=True, hide_index=True)

        col1, col2 = st.columns(2)

        with col1:
            st.metric("🎫 Tickets Created", len(events_df[events_df["event_type"] == "TICKET_CREATED"]))

        with col2:
            st.metric("📢 Notifications Sent", len(events_df[events_df["event_type"] == "NOTIFICATION_SENT"]))

    else:
        st.info("No workflow events yet. Run predictions with High Risk supplier.")


# ==============================================================================
# SIDEBAR
# ==============================================================================

with st.sidebar:
    st.image("https://via.placeholder.com/150x50/1f77b4/FFFFFF?text=SRRM+System", use_container_width=True)
    
    st.markdown("### 🏭 System Information")
    st.info(f"""
    **Environment:** Production  
    **Database:** Supabase PostgreSQL  
    **ML Framework:** LightGBM + SHAP  
    **Orchestration:** Apache Airflow  
    **Last Updated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    """)
    
    st.divider()
    
    st.markdown("### 🔄 Quick Actions")
    
    if st.button("🔄 Refresh Data", use_container_width=True):
        st.cache_data.clear()
        st.rerun()
    
    if st.button("📊 View Airflow UI", use_container_width=True):
        st.markdown(f"[Open Airflow]({AIRFLOW_API.replace('/api/v1', '')})", unsafe_allow_html=True)
    
    st.divider()
    
    st.markdown("### 📚 Documentation")
    st.markdown("""
    - [User Guide](#)
    - [API Reference](#)
    - [Model Documentation](#)
    """)
    
    st.divider()
    
    st.caption("© 2026 SRRM System | v1.0.0")
