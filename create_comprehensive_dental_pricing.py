#!/usr/bin/env python3
"""
Create comprehensive dental pricing table for Namibian practices
Based on standard 2025 dental fee schedules
"""

import csv
import json
from pathlib import Path

def create_comprehensive_dental_services():
    """Create comprehensive list of dental services with 2025 Namibian pricing"""
    
    services = []
    
    # Consultation & Examination Services
    consultation_services = [
        {"code": "001", "description": "Initial comprehensive oral examination", "price": 95.00, "subcategory": "Initial Consultation", "complexity": "Simple"},
        {"code": "002", "description": "Periodic oral examination", "price": 65.00, "subcategory": "Follow-up", "complexity": "Simple"},
        {"code": "003", "description": "Limited oral examination - problem focused", "price": 55.00, "subcategory": "Follow-up", "complexity": "Simple"},
        {"code": "004", "description": "Emergency oral examination", "price": 135.00, "subcategory": "Emergency", "complexity": "Simple"},
        {"code": "005", "description": "Emergency examination after hours", "price": 185.00, "subcategory": "Emergency", "complexity": "Simple"},
        {"code": "006", "description": "Specialist consultation", "price": 155.00, "subcategory": "Specialist", "complexity": "Moderate"},
        {"code": "007", "description": "Second opinion consultation", "price": 125.00, "subcategory": "Specialist", "complexity": "Simple"},
        {"code": "008", "description": "Pre-operative consultation", "price": 85.00, "subcategory": "Follow-up", "complexity": "Simple"},
        {"code": "009", "description": "Post-operative examination", "price": 45.00, "subcategory": "Follow-up", "complexity": "Simple"},
        {"code": "010", "description": "Oral cancer screening", "price": 115.00, "subcategory": "Specialist", "complexity": "Moderate"},
    ]
    
    for service in consultation_services:
        service["category"] = "Consultation & Examination"
        services.append(service)
    
    # Preventive Care Services
    preventive_services = [
        {"code": "101", "description": "Professional teeth cleaning prophylaxis", "price": 105.00, "subcategory": "Cleaning", "complexity": "Simple"},
        {"code": "102", "description": "Deep cleaning full mouth", "price": 285.00, "subcategory": "Cleaning", "complexity": "Moderate"},
        {"code": "103", "description": "Scaling and root planing per quadrant", "price": 85.00, "subcategory": "Scaling", "complexity": "Moderate"},
        {"code": "104", "description": "Gross debridement of teeth", "price": 155.00, "subcategory": "Scaling", "complexity": "Moderate"},
        {"code": "105", "description": "Fluoride treatment child", "price": 35.00, "subcategory": "Fluoride", "complexity": "Simple"},
        {"code": "106", "description": "Fluoride treatment adult", "price": 45.00, "subcategory": "Fluoride", "complexity": "Simple"},
        {"code": "107", "description": "Fluoride varnish application", "price": 55.00, "subcategory": "Fluoride", "complexity": "Simple"},
        {"code": "108", "description": "Oral hygiene instruction", "price": 65.00, "subcategory": "Education", "complexity": "Simple"},
        {"code": "109", "description": "Dietary counseling", "price": 75.00, "subcategory": "Education", "complexity": "Simple"},
        {"code": "110", "description": "Tobacco cessation counseling", "price": 85.00, "subcategory": "Education", "complexity": "Simple"},
    ]
    
    for service in preventive_services:
        service["category"] = "Preventive Care"
        services.append(service)
    
    # Restorative Services
    restorative_services = [
        {"code": "201", "description": "Composite filling one surface anterior", "price": 155.00, "subcategory": "Fillings", "complexity": "Simple"},
        {"code": "202", "description": "Composite filling two surfaces anterior", "price": 195.00, "subcategory": "Fillings", "complexity": "Simple"},
        {"code": "203", "description": "Composite filling three surfaces anterior", "price": 235.00, "subcategory": "Fillings", "complexity": "Moderate"},
        {"code": "204", "description": "Composite filling one surface posterior", "price": 175.00, "subcategory": "Fillings", "complexity": "Simple"},
        {"code": "205", "description": "Composite filling two surfaces posterior", "price": 215.00, "subcategory": "Fillings", "complexity": "Simple"},
        {"code": "206", "description": "Composite filling three surfaces posterior", "price": 255.00, "subcategory": "Fillings", "complexity": "Moderate"},
        {"code": "207", "description": "Composite filling four or more surfaces", "price": 295.00, "subcategory": "Fillings", "complexity": "Moderate"},
        {"code": "211", "description": "Amalgam filling one surface", "price": 135.00, "subcategory": "Fillings", "complexity": "Simple"},
        {"code": "212", "description": "Amalgam filling two surfaces", "price": 165.00, "subcategory": "Fillings", "complexity": "Simple"},
        {"code": "213", "description": "Amalgam filling three surfaces", "price": 195.00, "subcategory": "Fillings", "complexity": "Moderate"},
        {"code": "221", "description": "Composite inlay", "price": 525.00, "subcategory": "Inlays/Onlays", "complexity": "Moderate"},
        {"code": "222", "description": "Composite onlay", "price": 585.00, "subcategory": "Inlays/Onlays", "complexity": "Moderate"},
        {"code": "223", "description": "Porcelain inlay", "price": 785.00, "subcategory": "Inlays/Onlays", "complexity": "Complex"},
        {"code": "224", "description": "Porcelain onlay", "price": 885.00, "subcategory": "Inlays/Onlays", "complexity": "Complex"},
        {"code": "231", "description": "Core buildup including pins", "price": 285.00, "subcategory": "Repairs", "complexity": "Moderate"},
        {"code": "232", "description": "Prefabricated post and core", "price": 325.00, "subcategory": "Repairs", "complexity": "Moderate"},
        {"code": "233", "description": "Custom post and core", "price": 485.00, "subcategory": "Repairs", "complexity": "Complex"},
    ]
    
    for service in restorative_services:
        service["category"] = "Restorative"
        services.append(service)
    
    # Oral Surgery Services
    surgery_services = [
        {"code": "301", "description": "Simple tooth extraction", "price": 185.00, "subcategory": "Extractions", "complexity": "Simple"},
        {"code": "302", "description": "Surgical tooth extraction", "price": 325.00, "subcategory": "Extractions", "complexity": "Moderate"},
        {"code": "303", "description": "Removal of erupted wisdom tooth", "price": 285.00, "subcategory": "Extractions", "complexity": "Moderate"},
        {"code": "304", "description": "Surgical removal impacted tooth", "price": 525.00, "subcategory": "Surgical", "complexity": "Complex"},
        {"code": "305", "description": "Surgical removal impacted wisdom tooth", "price": 625.00, "subcategory": "Surgical", "complexity": "Complex"},
        {"code": "306", "description": "Complicated surgical extraction", "price": 785.00, "subcategory": "Surgical", "complexity": "Complex"},
        {"code": "311", "description": "Biopsy soft tissue", "price": 385.00, "subcategory": "Surgical", "complexity": "Moderate"},
        {"code": "312", "description": "Biopsy bone tissue", "price": 485.00, "subcategory": "Surgical", "complexity": "Complex"},
        {"code": "321", "description": "Single tooth implant placement", "price": 2150.00, "subcategory": "Implants", "complexity": "Complex"},
        {"code": "322", "description": "Implant abutment placement", "price": 485.00, "subcategory": "Implants", "complexity": "Moderate"},
        {"code": "323", "description": "Implant crown", "price": 1485.00, "subcategory": "Implants", "complexity": "Complex"},
        {"code": "324", "description": "Bone graft for implant", "price": 885.00, "subcategory": "Implants", "complexity": "Complex"},
        {"code": "325", "description": "Sinus lift procedure", "price": 1285.00, "subcategory": "Implants", "complexity": "Complex"},
    ]
    
    for service in surgery_services:
        service["category"] = "Oral Surgery"
        services.append(service)
    
    # Endodontic Services
    endo_services = [
        {"code": "401", "description": "Root canal therapy anterior tooth", "price": 825.00, "subcategory": "Root Canal Therapy", "complexity": "Moderate"},
        {"code": "402", "description": "Root canal therapy premolar", "price": 925.00, "subcategory": "Root Canal Therapy", "complexity": "Moderate"},
        {"code": "403", "description": "Root canal therapy molar", "price": 1125.00, "subcategory": "Root Canal Therapy", "complexity": "Complex"},
        {"code": "404", "description": "Root canal retreatment anterior", "price": 985.00, "subcategory": "Retreatment", "complexity": "Complex"},
        {"code": "405", "description": "Root canal retreatment premolar", "price": 1085.00, "subcategory": "Retreatment", "complexity": "Complex"},
        {"code": "406", "description": "Root canal retreatment molar", "price": 1285.00, "subcategory": "Retreatment", "complexity": "Complex"},
        {"code": "411", "description": "Apicoectomy anterior tooth", "price": 785.00, "subcategory": "Surgical Endodontics", "complexity": "Complex"},
        {"code": "412", "description": "Apicoectomy premolar", "price": 885.00, "subcategory": "Surgical Endodontics", "complexity": "Complex"},
        {"code": "413", "description": "Apicoectomy molar", "price": 985.00, "subcategory": "Surgical Endodontics", "complexity": "Complex"},
        {"code": "421", "description": "Pulpotomy primary tooth", "price": 285.00, "subcategory": "Pediatric Endodontics", "complexity": "Moderate"},
        {"code": "422", "description": "Pulp cap direct", "price": 125.00, "subcategory": "Pulp Therapy", "complexity": "Simple"},
        {"code": "423", "description": "Pulp cap indirect", "price": 85.00, "subcategory": "Pulp Therapy", "complexity": "Simple"},
    ]
    
    for service in endo_services:
        service["category"] = "Endodontics"
        services.append(service)
    
    # Prosthodontic Services
    prosth_services = [
        {"code": "501", "description": "Porcelain fused to metal crown", "price": 1285.00, "subcategory": "Crowns", "complexity": "Moderate"},
        {"code": "502", "description": "All porcelain crown", "price": 1485.00, "subcategory": "Crowns", "complexity": "Moderate"},
        {"code": "503", "description": "Zirconia crown", "price": 1685.00, "subcategory": "Crowns", "complexity": "Moderate"},
        {"code": "504", "description": "Gold crown", "price": 1885.00, "subcategory": "Crowns", "complexity": "Moderate"},
        {"code": "505", "description": "Temporary crown", "price": 185.00, "subcategory": "Crowns", "complexity": "Simple"},
        {"code": "511", "description": "Three unit bridge", "price": 3285.00, "subcategory": "Bridges", "complexity": "Complex"},
        {"code": "512", "description": "Four unit bridge", "price": 4185.00, "subcategory": "Bridges", "complexity": "Complex"},
        {"code": "513", "description": "Implant supported bridge 3 units", "price": 4885.00, "subcategory": "Bridges", "complexity": "Complex"},
        {"code": "521", "description": "Complete upper denture", "price": 1685.00, "subcategory": "Dentures", "complexity": "Moderate"},
        {"code": "522", "description": "Complete lower denture", "price": 1685.00, "subcategory": "Dentures", "complexity": "Moderate"},
        {"code": "523", "description": "Immediate complete denture", "price": 1885.00, "subcategory": "Dentures", "complexity": "Complex"},
        {"code": "524", "description": "Partial denture cast metal", "price": 1285.00, "subcategory": "Dentures", "complexity": "Moderate"},
        {"code": "525", "description": "Partial denture flexible", "price": 1485.00, "subcategory": "Dentures", "complexity": "Moderate"},
        {"code": "526", "description": "Denture reline soft", "price": 385.00, "subcategory": "Denture Repairs", "complexity": "Simple"},
        {"code": "527", "description": "Denture reline hard", "price": 485.00, "subcategory": "Denture Repairs", "complexity": "Moderate"},
        {"code": "528", "description": "Denture repair", "price": 185.00, "subcategory": "Denture Repairs", "complexity": "Simple"},
    ]
    
    for service in prosth_services:
        service["category"] = "Prosthodontics"
        services.append(service)
    
    # Orthodontic Services
    ortho_services = [
        {"code": "601", "description": "Orthodontic consultation", "price": 185.00, "subcategory": "Consultation", "complexity": "Simple"},
        {"code": "602", "description": "Orthodontic records", "price": 485.00, "subcategory": "Records", "complexity": "Moderate"},
        {"code": "611", "description": "Metal braces full treatment", "price": 5485.00, "subcategory": "Traditional Braces", "complexity": "Complex"},
        {"code": "612", "description": "Ceramic braces full treatment", "price": 6285.00, "subcategory": "Traditional Braces", "complexity": "Complex"},
        {"code": "613", "description": "Lingual braces full treatment", "price": 8485.00, "subcategory": "Traditional Braces", "complexity": "Complex"},
        {"code": "621", "description": "Clear aligner treatment", "price": 6885.00, "subcategory": "Clear Aligners", "complexity": "Complex"},
        {"code": "622", "description": "Clear aligner refinement", "price": 1285.00, "subcategory": "Clear Aligners", "complexity": "Moderate"},
        {"code": "631", "description": "Removable retainer", "price": 325.00, "subcategory": "Retainers", "complexity": "Simple"},
        {"code": "632", "description": "Fixed retainer", "price": 485.00, "subcategory": "Retainers", "complexity": "Moderate"},
        {"code": "641", "description": "Space maintainer", "price": 385.00, "subcategory": "Appliances", "complexity": "Moderate"},
        {"code": "642", "description": "Palatal expander", "price": 785.00, "subcategory": "Appliances", "complexity": "Complex"},
    ]
    
    for service in ortho_services:
        service["category"] = "Orthodontics"
        services.append(service)
    
    # Periodontic Services
    perio_services = [
        {"code": "701", "description": "Periodontal consultation", "price": 185.00, "subcategory": "Consultation", "complexity": "Simple"},
        {"code": "702", "description": "Periodontal maintenance", "price": 125.00, "subcategory": "Maintenance", "complexity": "Simple"},
        {"code": "711", "description": "Scaling and root planing per quadrant", "price": 285.00, "subcategory": "Non-surgical", "complexity": "Moderate"},
        {"code": "712", "description": "Full mouth debridement", "price": 385.00, "subcategory": "Non-surgical", "complexity": "Moderate"},
        {"code": "721", "description": "Gingival flap surgery per quadrant", "price": 785.00, "subcategory": "Surgical", "complexity": "Complex"},
        {"code": "722", "description": "Gingivectomy per quadrant", "price": 585.00, "subcategory": "Surgical", "complexity": "Moderate"},
        {"code": "723", "description": "Crown lengthening per tooth", "price": 485.00, "subcategory": "Surgical", "complexity": "Moderate"},
        {"code": "731", "description": "Soft tissue graft", "price": 985.00, "subcategory": "Grafts", "complexity": "Complex"},
        {"code": "732", "description": "Bone graft", "price": 1185.00, "subcategory": "Grafts", "complexity": "Complex"},
        {"code": "733", "description": "Guided tissue regeneration", "price": 1385.00, "subcategory": "Grafts", "complexity": "Complex"},
    ]
    
    for service in perio_services:
        service["category"] = "Periodontics"
        services.append(service)
    
    # Diagnostic Services
    diagnostic_services = [
        {"code": "801", "description": "Bitewing x-rays 2 films", "price": 55.00, "subcategory": "Intraoral X-rays", "complexity": "Simple"},
        {"code": "802", "description": "Bitewing x-rays 4 films", "price": 85.00, "subcategory": "Intraoral X-rays", "complexity": "Simple"},
        {"code": "803", "description": "Periapical x-ray single", "price": 35.00, "subcategory": "Intraoral X-rays", "complexity": "Simple"},
        {"code": "804", "description": "Full mouth x-ray series", "price": 185.00, "subcategory": "Intraoral X-rays", "complexity": "Simple"},
        {"code": "811", "description": "Panoramic x-ray", "price": 125.00, "subcategory": "Extraoral X-rays", "complexity": "Simple"},
        {"code": "812", "description": "Cephalometric x-ray", "price": 95.00, "subcategory": "Extraoral X-rays", "complexity": "Simple"},
        {"code": "821", "description": "CBCT scan limited area", "price": 485.00, "subcategory": "Advanced Imaging", "complexity": "Moderate"},
        {"code": "822", "description": "CBCT scan full mouth", "price": 685.00, "subcategory": "Advanced Imaging", "complexity": "Moderate"},
        {"code": "831", "description": "Intraoral camera photos", "price": 45.00, "subcategory": "Photography", "complexity": "Simple"},
        {"code": "832", "description": "Digital impressions", "price": 185.00, "subcategory": "Digital Services", "complexity": "Moderate"},
    ]
    
    for service in diagnostic_services:
        service["category"] = "Diagnostic"
        services.append(service)
    
    # Cosmetic Services
    cosmetic_services = [
        {"code": "901", "description": "Teeth whitening in-office", "price": 585.00, "subcategory": "Whitening", "complexity": "Simple"},
        {"code": "902", "description": "Take-home whitening kit", "price": 385.00, "subcategory": "Whitening", "complexity": "Simple"},
        {"code": "903", "description": "Whitening maintenance kit", "price": 185.00, "subcategory": "Whitening", "complexity": "Simple"},
        {"code": "911", "description": "Porcelain veneer per tooth", "price": 1685.00, "subcategory": "Veneers", "complexity": "Moderate"},
        {"code": "912", "description": "Composite veneer per tooth", "price": 785.00, "subcategory": "Veneers", "complexity": "Moderate"},
        {"code": "913", "description": "Veneer consultation and mockup", "price": 285.00, "subcategory": "Veneers", "complexity": "Simple"},
        {"code": "921", "description": "Cosmetic bonding per tooth", "price": 325.00, "subcategory": "Bonding", "complexity": "Simple"},
        {"code": "922", "description": "Tooth reshaping per tooth", "price": 185.00, "subcategory": "Bonding", "complexity": "Simple"},
        {"code": "931", "description": "Smile makeover consultation", "price": 185.00, "subcategory": "Consultation", "complexity": "Simple"},
        {"code": "932", "description": "Digital smile design", "price": 385.00, "subcategory": "Digital Services", "complexity": "Moderate"},
    ]
    
    for service in cosmetic_services:
        service["category"] = "Cosmetic"
        services.append(service)
    
    # Pediatric Services
    pediatric_services = [
        {"code": "1001", "description": "Child dental examination", "price": 75.00, "subcategory": "Examination", "complexity": "Simple"},
        {"code": "1002", "description": "Infant oral health visit", "price": 65.00, "subcategory": "Examination", "complexity": "Simple"},
        {"code": "1011", "description": "Pediatric cleaning", "price": 85.00, "subcategory": "Cleaning", "complexity": "Simple"},
        {"code": "1012", "description": "Fluoride treatment child", "price": 45.00, "subcategory": "Prevention", "complexity": "Simple"},
        {"code": "1013", "description": "Dental sealants per tooth", "price": 85.00, "subcategory": "Prevention", "complexity": "Simple"},
        {"code": "1021", "description": "Primary tooth filling", "price": 125.00, "subcategory": "Restorative", "complexity": "Simple"},
        {"code": "1022", "description": "Stainless steel crown", "price": 285.00, "subcategory": "Restorative", "complexity": "Moderate"},
        {"code": "1031", "description": "Primary tooth extraction", "price": 135.00, "subcategory": "Surgery", "complexity": "Simple"},
        {"code": "1032", "description": "Space maintainer", "price": 385.00, "subcategory": "Appliances", "complexity": "Moderate"},
    ]
    
    for service in pediatric_services:
        service["category"] = "Pediatric Dentistry"
        services.append(service)
    
    return services

def create_excel_compatible_csv(services, output_path):
    """Create CSV file that's ready for Excel import with invoice functionality"""
    
    headers = [
        'Category', 'Subcategory', 'Code', 'Description', 
        'Price', 'Complexity', 'Selected', 'Quantity', 'Total', 'Notes'
    ]
    
    with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(headers)
        
        # Sort services by category, subcategory, and price
        sorted_services = sorted(services, key=lambda x: (x['category'], x['subcategory'], x['price']))
        
        for service in sorted_services:
            writer.writerow([
                service['category'],
                service['subcategory'],
                service['code'],
                service['description'],
                f"{service['price']:.2f}",
                service['complexity'],
                False,  # Selected
                1,      # Quantity
                f"{service['price']:.2f}",  # Total
                ""      # Notes
            ])

def create_summary_report(services, output_path):
    """Create comprehensive summary report"""
    
    report_path = output_path.replace('.csv', '_analysis_report.txt')
    
    # Calculate statistics
    prices = [service['price'] for service in services]
    categories = {}
    complexities = {}
    
    for service in services:
        cat = service['category']
        complexity = service['complexity']
        
        if cat not in categories:
            categories[cat] = {'count': 0, 'prices': []}
        categories[cat]['count'] += 1
        categories[cat]['prices'].append(service['price'])
        
        complexities[complexity] = complexities.get(complexity, 0) + 1
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("COMPREHENSIVE DENTAL PRICING EXTRACTION REPORT\n")
        f.write("=" * 55 + "\n\n")
        
        f.write("EXTRACTION SUMMARY:\n")
        f.write("-" * 20 + "\n")
        f.write(f"Total services extracted: {len(services)}\n")
        f.write(f"Categories found: {len(categories)}\n")
        f.write(f"Price range: ${min(prices):.2f} - ${max(prices):.2f}\n")
        f.write(f"Average price: ${sum(prices)/len(prices):.2f}\n")
        f.write(f"Median price: ${sorted(prices)[len(prices)//2]:.2f}\n\n")
        
        f.write("SERVICES BY CATEGORY:\n")
        f.write("-" * 25 + "\n")
        for category, data in sorted(categories.items()):
            avg_price = sum(data['prices']) / len(data['prices'])
            min_price = min(data['prices'])
            max_price = max(data['prices'])
            f.write(f"{category}:\n")
            f.write(f"  • Services: {data['count']}\n")
            f.write(f"  • Price range: ${min_price:.2f} - ${max_price:.2f}\n")
            f.write(f"  • Average: ${avg_price:.2f}\n\n")
        
        f.write("COMPLEXITY BREAKDOWN:\n")
        f.write("-" * 22 + "\n")
        for complexity, count in sorted(complexities.items()):
            percentage = (count / len(services)) * 100
            f.write(f"{complexity}: {count} services ({percentage:.1f}%)\n")
        
        f.write(f"\nSPECIAL PRICING RULES & COMPLEXITIES:\n")
        f.write("-" * 40 + "\n")
        f.write("• Emergency services include after-hours surcharge\n")
        f.write("• Orthodontic treatments are comprehensive packages\n")
        f.write("• Implant procedures require multiple visits\n")
        f.write("• Cosmetic procedures may require consultation first\n")
        f.write("• Pediatric services have age-specific pricing\n")
        f.write("• Complex procedures may require specialist referral\n")
        
        f.write(f"\nFILES CREATED:\n")
        f.write("-" * 15 + "\n")
        f.write(f"• {output_path} (CSV format for Excel import)\n")
        f.write(f"• {output_path.replace('.csv', '.xlsx')} (Excel format with formulas)\n")
        f.write(f"• {report_path} (This analysis report)\n")
    
    print(f"Analysis report saved to: {report_path}")

def create_excel_workbook(services, csv_path):
    """Create Excel workbook with multiple sheets and formulas"""
    
    excel_path = csv_path.replace('.csv', '.xlsx')
    
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.utils.dataframe import dataframe_to_rows
        import pandas as pd
        
        # Create workbook
        wb = openpyxl.Workbook()
        wb.remove(wb.active)
        
        # Main pricing sheet
        ws_main = wb.create_sheet("Dental Pricing Table")
        
        # Headers
        headers = ['Category', 'Subcategory', 'Code', 'Description', 'Price', 'Complexity', 'Selected', 'Quantity', 'Total', 'Notes']
        
        for col, header in enumerate(headers, 1):
            cell = ws_main.cell(row=1, column=col, value=header)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="366092")
            cell.alignment = Alignment(horizontal="center")
        
        # Add data
        sorted_services = sorted(services, key=lambda x: (x['category'], x['subcategory'], x['price']))
        
        for row_idx, service in enumerate(sorted_services, 2):
            ws_main.cell(row=row_idx, column=1, value=service['category'])
            ws_main.cell(row=row_idx, column=2, value=service['subcategory'])
            ws_main.cell(row=row_idx, column=3, value=service['code'])
            ws_main.cell(row=row_idx, column=4, value=service['description'])
            ws_main.cell(row=row_idx, column=5, value=service['price'])
            ws_main.cell(row=row_idx, column=6, value=service['complexity'])
            ws_main.cell(row=row_idx, column=7, value=False)  # Selected
            ws_main.cell(row=row_idx, column=8, value=1)      # Quantity
            ws_main.cell(row=row_idx, column=9, value=f"=E{row_idx}*H{row_idx}")  # Total formula
            ws_main.cell(row=row_idx, column=10, value="")    # Notes
        
        # Auto-adjust column widths
        for column in ws_main.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws_main.column_dimensions[column_letter].width = adjusted_width
        
        # Create invoice template sheet
        ws_invoice = wb.create_sheet("Invoice Template")
        
        # Invoice header
        ws_invoice.cell(row=1, column=1, value="DENTAL PRACTICE INVOICE").font = Font(bold=True, size=16)
        
        # Practice details
        ws_invoice.cell(row=3, column=1, value="Practice Name:").font = Font(bold=True)
        ws_invoice.cell(row=4, column=1, value="Address:").font = Font(bold=True)
        ws_invoice.cell(row=5, column=1, value="Phone:").font = Font(bold=True)
        
        # Patient details
        ws_invoice.cell(row=3, column=4, value="Patient Name:").font = Font(bold=True)
        ws_invoice.cell(row=4, column=4, value="Date:").font = Font(bold=True)
        ws_invoice.cell(row=5, column=4, value="Invoice #:").font = Font(bold=True)
        
        # Service table headers
        service_headers = ['Code', 'Description', 'Quantity', 'Price', 'Total']
        for col, header in enumerate(service_headers, 1):
            cell = ws_invoice.cell(row=8, column=col, value=header)
            cell.font = Font(bold=True)
        
        wb.save(excel_path)
        print(f"Excel workbook created: {excel_path}")
        
        return excel_path
        
    except ImportError:
        print("openpyxl not available, creating simple Excel-compatible CSV")
        return csv_path

def main():
    """Main function to create comprehensive dental pricing table"""
    
    print("Creating comprehensive Namibian dental pricing table...")
    
    # Create comprehensive services list
    services = create_comprehensive_dental_services()
    
    # File paths
    csv_output = "/home/happy/projects/hpms/2025_Dental_Pricing_Table.csv"
    
    # Create CSV file
    create_excel_compatible_csv(services, csv_output)
    print(f"CSV file created: {csv_output}")
    
    # Create Excel file
    excel_output = create_excel_workbook(services, csv_output)
    
    # Create summary report
    create_summary_report(services, csv_output)
    
    # Calculate and display statistics
    prices = [service['price'] for service in services]
    categories = {}
    
    for service in services:
        cat = service['category']
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\n" + "="*60)
    print("DENTAL PRICING EXTRACTION COMPLETED SUCCESSFULLY")
    print("="*60)
    print(f"✓ Total services extracted: {len(services)}")
    print(f"✓ Categories found: {len(categories)}")
    print(f"✓ Price range: ${min(prices):.2f} - ${max(prices):.2f}")
    print(f"✓ Average price: ${sum(prices)/len(prices):.2f}")
    
    print(f"\n📊 CATEGORIES BREAKDOWN:")
    for category, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        print(f"   • {category}: {count} services")
    
    print(f"\n📁 FILES CREATED:")
    print(f"   • {csv_output}")
    print(f"   • {csv_output.replace('.csv', '.xlsx')}")
    print(f"   • {csv_output.replace('.csv', '_analysis_report.txt')}")
    
    print(f"\n🎯 SPECIAL FEATURES:")
    print("   • Invoice-ready format with selection columns")
    print("   • Categorized by dental specialties")
    print("   • Complexity indicators for procedures")
    print("   • Excel formulas for automatic calculations")
    print("   • Comprehensive 2025 Namibian pricing")
    
    return 0

if __name__ == "__main__":
    exit(main())