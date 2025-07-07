#!/usr/bin/env python3
"""
Simple CSV to Excel converter using built-in modules
"""

import csv
import json

def create_excel_xml(csv_path, excel_path):
    """Create Excel XML format file"""
    
    # Read CSV data
    data = []
    with open(csv_path, 'r', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            data.append(row)
    
    # Create Excel XML content
    xml_content = '''<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>HPMS Dental Pricing Extractor</Author>
  <LastAuthor>HPMS</LastAuthor>
  <Created>2025-06-04</Created>
  <Title>2025 Dental Practitioners Pricing Table</Title>
  <Subject>Comprehensive Dental Fee Schedule</Subject>
 </DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
  <WindowHeight>9000</WindowHeight>
  <WindowWidth>13860</WindowWidth>
  <WindowTopX>240</WindowTopX>
  <WindowTopY>75</WindowTopY>
  <ProtectStructure>False</ProtectStructure>
  <ProtectWindows>False</ProtectWindows>
 </ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="s21">
   <Font x:Family="Swiss" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#366092" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="s22">
   <NumberFormat ss:Format="$#,##0.00"/>
  </Style>
  <Style ss:ID="s23">
   <NumberFormat ss:Format="$#,##0.00"/>
   <Font ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Dental Pricing Table">
  <Table ss:ExpandedColumnCount="10" ss:ExpandedRowCount="''' + str(len(data)) + '''">'''
    
    # Add column definitions
    xml_content += '''
   <Column ss:AutoFitWidth="0" ss:Width="120"/>
   <Column ss:AutoFitWidth="0" ss:Width="100"/>
   <Column ss:AutoFitWidth="0" ss:Width="60"/>
   <Column ss:AutoFitWidth="0" ss:Width="300"/>
   <Column ss:AutoFitWidth="0" ss:Width="80"/>
   <Column ss:AutoFitWidth="0" ss:Width="80"/>
   <Column ss:AutoFitWidth="0" ss:Width="60"/>
   <Column ss:AutoFitWidth="0" ss:Width="60"/>
   <Column ss:AutoFitWidth="0" ss:Width="80"/>
   <Column ss:AutoFitWidth="0" ss:Width="200"/>'''
    
    # Add data rows
    for row_idx, row in enumerate(data):
        if row_idx == 0:  # Header row
            xml_content += '\n   <Row>'
            for cell in row:
                xml_content += f'\n    <Cell ss:StyleID="s21"><Data ss:Type="String">{cell}</Data></Cell>'
            xml_content += '\n   </Row>'
        else:
            xml_content += '\n   <Row>'
            for col_idx, cell in enumerate(row):
                if col_idx in [4, 8]:  # Price columns
                    try:
                        price_val = float(cell)
                        xml_content += f'\n    <Cell ss:StyleID="s22"><Data ss:Type="Number">{price_val}</Data></Cell>'
                    except:
                        xml_content += f'\n    <Cell><Data ss:Type="String">{cell}</Data></Cell>'
                elif col_idx == 6:  # Selected column (boolean)
                    xml_content += f'\n    <Cell><Data ss:Type="Boolean">{str(cell).lower()}</Data></Cell>'
                elif col_idx == 7:  # Quantity column (number)
                    try:
                        qty_val = int(cell)
                        xml_content += f'\n    <Cell><Data ss:Type="Number">{qty_val}</Data></Cell>'
                    except:
                        xml_content += f'\n    <Cell><Data ss:Type="String">{cell}</Data></Cell>'
                else:
                    xml_content += f'\n    <Cell><Data ss:Type="String">{cell}</Data></Cell>'
            xml_content += '\n   </Row>'
    
    xml_content += '''
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Invoice Template">
  <Table ss:ExpandedColumnCount="6" ss:ExpandedRowCount="30">
   <Row>
    <Cell ss:MergeAcross="5" ss:StyleID="s21"><Data ss:Type="String">DENTAL PRACTICE INVOICE</Data></Cell>
   </Row>
   <Row></Row>
   <Row>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Practice Name:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">[Enter Practice Name]</Data></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Patient Name:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">[Enter Patient Name]</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Address:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">[Enter Address]</Data></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Date:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">[Enter Date]</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Phone:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">[Enter Phone]</Data></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Invoice #:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">[Enter Invoice Number]</Data></Cell>
   </Row>
   <Row></Row>
   <Row>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Code</Data></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Quantity</Data></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Unit Price</Data></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Total</Data></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Notes</Data></Cell>
   </Row>'''
    
    # Add empty invoice rows
    for i in range(15):
        xml_content += '''
   <Row>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell><Data ss:Type="Number">1</Data></Cell>
    <Cell ss:StyleID="s22"><Data ss:Type="Number">0</Data></Cell>
    <Cell ss:StyleID="s23"><Data ss:Type="Number">0</Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
   </Row>'''
    
    xml_content += '''
   <Row></Row>
   <Row>
    <Cell></Cell>
    <Cell></Cell>
    <Cell></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Subtotal:</Data></Cell>
    <Cell ss:StyleID="s23"><Data ss:Type="Number">0</Data></Cell>
    <Cell></Cell>
   </Row>
   <Row>
    <Cell></Cell>
    <Cell></Cell>
    <Cell></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Tax (15%):</Data></Cell>
    <Cell ss:StyleID="s23"><Data ss:Type="Number">0</Data></Cell>
    <Cell></Cell>
   </Row>
   <Row>
    <Cell></Cell>
    <Cell></Cell>
    <Cell></Cell>
    <Cell ss:StyleID="s21"><Data ss:Type="String">Total:</Data></Cell>
    <Cell ss:StyleID="s23"><Data ss:Type="Number">0</Data></Cell>
    <Cell></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>'''
    
    # Write Excel XML file
    with open(excel_path, 'w', encoding='utf-8') as f:
        f.write(xml_content)
    
    print(f"Excel file created: {excel_path}")

def main():
    csv_path = "/home/happy/projects/hpms/2025_Dental_Pricing_Table.csv"
    excel_path = "/home/happy/projects/hpms/2025_Dental_Pricing_Table.xlsx"
    
    create_excel_xml(csv_path, excel_path)
    
    print("Excel conversion completed!")

if __name__ == "__main__":
    main()