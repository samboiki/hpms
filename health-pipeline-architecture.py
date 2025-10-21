#!/usr/bin/env python3
"""
Health Information Data Pipeline Architecture
Using diagrams library with real service icons
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import EC2, Lambda
from diagrams.aws.database import RDS, Dynamodb
from diagrams.aws.network import APIGateway, CloudFront
from diagrams.aws.analytics import Analytics, Quicksight
from diagrams.aws.integration import SQS
from diagrams.aws.storage import S3
from diagrams.aws.security import Shield
from diagrams.onprem.database import PostgreSQL, MongoDB
from diagrams.onprem.compute import Server
from diagrams.onprem.client import Client, Users
from diagrams.onprem.analytics import Databricks, Tableau
from diagrams.onprem.monitoring import Grafana, Prometheus
from diagrams.onprem.network import Nginx
from diagrams.programming.framework import Flask, React
from diagrams.programming.language import Python
from diagrams.azure.analytics import DataFactory
from diagrams.azure.database import DatabaseForPostgresql
from diagrams.azure.integration import EventGridDomains

# Graph attributes for better layout
graph_attr = {
    "fontsize": "45",
    "bgcolor": "white",
    "pad": "0.3",
    "ranksep": "1.0",
    "nodesep": "0.7",
    "splines": "ortho"
}

with Diagram("Health Information Data Pipeline Architecture",
             filename="health_architecture",
             show=False,
             direction="TB",
             graph_attr=graph_attr):

    # === PHASE 1: FACILITY LEVEL (263 SITES) ===
    with Cluster("Healthcare Facilities - 263 Sites", graph_attr={"bgcolor": "#E8F5E9", "style": "rounded", "penwidth": "2"}):
        with Cluster("Facility Systems"):
            quantum_db = PostgreSQL("Quantum ePMS\nPatient Database")
            edt_db = PostgreSQL("EDT\nDispensing Database")

        with Cluster("Data Extraction Layer"):
            etl_agent = Python("Python ETL Agent")
            scheduler = Server("Cron Scheduler")

        facility_users = Users("Facility Staff")

    # === STAGE 1: RME GATEKEEPER HUB ===
    with Cluster("Stage 1: RME 'Gatekeeper' Hub", graph_attr={"bgcolor": "#E3F2FD", "style": "rounded", "penwidth": "3"}):

        with Cluster("API Gateway"):
            api_gateway = APIGateway("API Gateway")
            flask_api = Flask("Flask REST API")
            nginx = Nginx("Nginx\nLoad Balancer")

        with Cluster("Data Processing Pipeline"):
            staging = RDS("Staging\nDatabase")
            etl_processor = DataFactory("ETL Pipeline")
            quality_checker = Lambda("Data Quality\nChecker")
            dedup_engine = Lambda("Deduplication\nEngine")
            clean_db = DatabaseForPostgresql("Clean Database\nConsolidated")

        with Cluster("Analytics & Reporting"):
            analytics_engine = Databricks("Analytics Engine")
            rme_dashboard = Grafana("RME Dashboard")
            monitoring = Prometheus("Health Monitor")

        with Cluster("Feedback System"):
            feedback_queue = SQS("Feedback Queue")
            feedback_processor = Lambda("Feedback\nProcessor")

        rme_users = Users("RME Analysts")

    # === STAGE 2: NATIONAL DATA WAREHOUSE ===
    with Cluster("Stage 2: NDW 'Master Assembler'", graph_attr={"bgcolor": "#FFF3E0", "style": "rounded", "penwidth": "3"}):

        with Cluster("Data Intake"):
            ndw_gateway = APIGateway("NDW Gateway")
            validation = Shield("Validation Layer")

        with Cluster("National Database"):
            data_lake = S3("Data Lake")
            ndw_warehouse = MongoDB("National Data\nWarehouse")

        with Cluster("External Integration"):
            meditech_api = Server("Meditech API\nLab System")
            lab_database = PostgreSQL("National Lab\nRepository")

        with Cluster("Master Processing"):
            master_etl = DataFactory("Master ETL")
            linkage_engine = Analytics("Linkage Engine")
            ml_processor = Lambda("ML Processor")

        with Cluster("National Analytics"):
            unified_db = Dynamodb("Unified Patient\nRecords")
            national_dashboard = Quicksight("National\nDashboards")
            reporting = Tableau("Executive\nReporting")

        stakeholders = Users("MoHSS\nStakeholders")

    # === DATA FLOW CONNECTIONS ===

    # Facility to Agent
    quantum_db >> Edge(label="Extract", style="dashed") >> etl_agent
    edt_db >> Edge(label="Extract", style="dashed") >> etl_agent
    scheduler >> Edge(label="Trigger", style="dotted") >> etl_agent

    # Agent to RME Hub
    etl_agent >> Edge(label="Secure Transfer\n(Incremental)", color="blue", penwidth="2") >> api_gateway
    api_gateway >> nginx >> flask_api

    # RME Processing Flow
    flask_api >> staging
    staging >> etl_processor
    etl_processor >> quality_checker
    quality_checker >> dedup_engine
    dedup_engine >> clean_db

    # RME Analytics
    clean_db >> analytics_engine
    analytics_engine >> rme_dashboard
    rme_dashboard >> rme_users

    # Monitoring
    flask_api >> Edge(style="dotted", color="gray") >> monitoring
    etl_processor >> Edge(style="dotted", color="gray") >> monitoring

    # Feedback Loop
    quality_checker >> Edge(label="Errors", color="red", style="dashed") >> feedback_queue
    feedback_queue >> feedback_processor
    feedback_processor >> Edge(label="DQ Report", color="purple", penwidth="2") >> etl_agent
    etl_agent >> Edge(label="Error Dashboard", color="purple", style="dashed") >> facility_users

    # RME to NDW
    clean_db >> Edge(label="Clean Data", color="green", penwidth="3") >> ndw_gateway
    ndw_gateway >> validation
    validation >> data_lake
    data_lake >> ndw_warehouse

    # Lab Integration
    meditech_api >> Edge(label="Lab Results", style="dotted") >> lab_database
    lab_database >> master_etl
    ndw_warehouse >> master_etl

    # Master Processing
    master_etl >> linkage_engine
    linkage_engine >> ml_processor
    ml_processor >> unified_db

    # National Analytics
    unified_db >> national_dashboard
    national_dashboard >> reporting
    reporting >> stakeholders

    # Enhanced Feedback
    unified_db >> Edge(label="Lab Data", color="orange", style="dashed") >> feedback_queue

print("✅ Architecture diagram generated successfully!")
print("📊 Output file: health_architecture.png")
print("💡 To view the diagram, you need Graphviz installed.")
print("   Install from: https://graphviz.org/download/")