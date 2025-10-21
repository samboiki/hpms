#!/usr/bin/env python3
"""
Simplified Health Pipeline with Real Icons
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.network import APIGateway
from diagrams.aws.database import RDS, Dynamodb
from diagrams.aws.compute import Lambda
from diagrams.aws.analytics import Analytics, Quicksight
from diagrams.aws.integration import SQS
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.client import Users
from diagrams.onprem.analytics import Databricks
from diagrams.onprem.monitoring import Grafana
from diagrams.programming.framework import Flask
from diagrams.programming.language import Python

with Diagram("Health Data Pipeline", filename="health_pipeline_simple", show=False, direction="LR"):

    # Facilities
    with Cluster("263 Healthcare Facilities"):
        facilities = [
            PostgreSQL("Quantum ePMS"),
            PostgreSQL("EDT System"),
            Python("ETL Agent")
        ]
        staff = Users("Staff")

    # RME Hub
    with Cluster("RME Gatekeeper Hub"):
        api = APIGateway("API Gateway")
        flask = Flask("Flask API")
        staging = RDS("Staging DB")
        etl = Databricks("ETL Engine")
        clean = PostgreSQL("Clean DB")
        dashboard = Grafana("RME Dashboard")
        feedback = SQS("Feedback Queue")

    # NDW
    with Cluster("National Data Warehouse"):
        ndw_api = APIGateway("NDW Gateway")
        warehouse = Dynamodb("Data Warehouse")
        lab = PostgreSQL("Lab Data")
        linkage = Analytics("Linkage Engine")
        unified = Dynamodb("Unified Records")
        national = Quicksight("National Dashboard")

    users = Users("MoHSS Leaders")

    # Connections
    facilities[2] >> Edge(label="Secure Transfer", color="blue") >> api
    api >> flask >> staging >> etl >> clean
    clean >> dashboard
    clean >> Edge(label="Clean Data", color="green") >> ndw_api
    ndw_api >> warehouse
    lab >> linkage
    warehouse >> linkage >> unified >> national >> users

    # Feedback loop
    etl >> Edge(label="Errors", color="red") >> feedback
    feedback >> Edge(label="DQ Report", color="purple") >> facilities[2]
    facilities[2] >> Edge(label="Reports", color="purple") >> staff

print("Diagram created: health_pipeline_simple.png")