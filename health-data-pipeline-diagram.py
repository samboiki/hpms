#!/usr/bin/env python3
"""
Health Information Data Pipeline Architecture Diagram
Using diagrams.mingrammer.com library
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.database import PostgreSQL, MongoDB
from diagrams.onprem.compute import Server
from diagrams.onprem.client import Client, Users
from diagrams.onprem.analytics import Databricks
from diagrams.onprem.monitoring import Grafana
from diagrams.programming.framework import Flask
from diagrams.programming.language import Python
from diagrams.generic.blank import Blank
from diagrams.generic.storage import Storage
from diagrams.generic.compute import Rack
from diagrams.onprem.network import Internet
from diagrams.aws.integration import SQS
from diagrams.aws.analytics import Analytics

# Custom colors for different stages
facility_color = "#E8F5E9"
rme_color = "#E3F2FD"
ndw_color = "#FFF3E0"
feedback_color = "#FCE4EC"

with Diagram("Integrated Health Information Pipeline",
             filename="health_pipeline",
             show=False,
             direction="TB",
             graph_attr={
                 "fontsize": "14",
                 "bgcolor": "white",
                 "pad": "0.5",
                 "ranksep": "1.5",
                 "nodesep": "0.8"
             }):

    # Title placeholder
    title = Blank("Phased Incremental Data Pipeline\nFrom Facilities to National Level")

    # Phase 1: Facility Level Data Sources
    with Cluster("Healthcare Facilities (263 Sites)", graph_attr={"bgcolor": facility_color, "style": "rounded,filled"}):
        with Cluster("Facility Systems"):
            quantum = Storage("Quantum ePMS\n(Patient Data)")
            edt = Storage("EDT\n(Dispensing Tool)")

        with Cluster("ETL Agent"):
            agent = Python("Python ETL Agent\n(Incremental Extract)")

        facility_staff = Users("Facility Staff")

    # Data extraction flow
    quantum >> Edge(label="Extract New/Updated", style="dashed") >> agent
    edt >> Edge(label="Extract New/Updated", style="dashed") >> agent

    # Stage 1: RME Gatekeeper Hub
    with Cluster("Stage 1: RME 'Gatekeeper' Hub", graph_attr={"bgcolor": rme_color, "style": "rounded,filled", "penwidth": "2"}):

        with Cluster("Data Ingestion"):
            api = Flask("Flask API\n(Secure Receiver)")

        with Cluster("Data Processing"):
            staging_db = PostgreSQL("Staging DB\n(Raw Data)")
            etl_engine = Databricks("ETL Engine\n(Clean & Validate)")
            clean_db = PostgreSQL("Clean Database\n(Consolidated)")

        with Cluster("Quality Control"):
            dq_checker = Analytics("Data Quality\nChecker")
            dedup = Server("Deduplication\nEngine")

        with Cluster("RME Operations"):
            rme_reports = Grafana("RME Dashboard\n(Real-time Reports)")
            rme_users = Users("RME Analysts")

    # RME internal flow
    api >> staging_db >> etl_engine
    etl_engine >> dq_checker >> dedup >> clean_db
    clean_db >> rme_reports >> rme_users

    # Feedback loop components
    feedback_gen = SQS("JSON Feedback\nGenerator")
    dq_checker >> Edge(label="Errors Found", color="red", style="dashed") >> feedback_gen

    # Stage 2: National Data Warehouse
    with Cluster("Stage 2: NDW 'Master Assembler'", graph_attr={"bgcolor": ndw_color, "style": "rounded,filled", "penwidth": "2"}):

        with Cluster("National Integration"):
            ndw_intake = Server("NDW Intake\n(Clean Data Only)")
            ndw_db = MongoDB("National Data\nWarehouse")

        with Cluster("External Sources"):
            meditech = Storage("Meditech API\n(Lab Results)")
            lab_repo = PostgreSQL("National Lab\nRepository")

        with Cluster("Data Linkage"):
            linkage = Databricks("Master Linkage\nEngine")
            unified = Storage("Unified Patient\nRecords")

        with Cluster("National Analytics"):
            analytics = Grafana("National\nDashboards")
            stakeholders = Users("MoHSS\nStakeholders")

    # NDW internal flow
    clean_db >> Edge(label="Clean Data", color="green", penwidth="2") >> ndw_intake
    ndw_intake >> ndw_db
    meditech >> Edge(label="Lab Data API", style="dotted") >> lab_repo
    lab_repo >> linkage
    ndw_db >> linkage
    linkage >> unified
    unified >> analytics >> stakeholders

    # Main data flow connections
    agent >> Edge(label="Secure Transfer\n(Incremental)", color="blue", penwidth="2") >> api

    # Feedback loop back to facilities
    feedback_gen >> Edge(label="DQ Feedback", color="purple", style="dashed", penwidth="2") >> agent
    agent >> Edge(label="Error Reports", color="purple", style="dashed") >> facility_staff

    # Enhanced feedback from NDW
    unified >> Edge(label="Enhanced Feedback\n(with Lab Data)", color="orange", style="dashed") >> feedback_gen

    # Monitoring component
    with Cluster("System Monitoring", graph_attr={"style": "dashed"}):
        monitor = Grafana("Pipeline Health\nMonitoring")

    api >> Edge(style="dotted", color="gray") >> monitor
    etl_engine >> Edge(style="dotted", color="gray") >> monitor
    linkage >> Edge(style="dotted", color="gray") >> monitor

print("Diagram generated successfully! Check 'health_pipeline.png'")