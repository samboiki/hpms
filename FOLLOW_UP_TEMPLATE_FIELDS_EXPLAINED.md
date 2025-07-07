# Follow-up Template Fields Explained

## Template Fields Overview

### 1. Notes Template
**Purpose**: Pre-filled text that appears in the visit notes when a follow-up is created.

**How it works**:
- The text you enter here will automatically populate the notes field of the scheduled follow-up visit
- Use the placeholder `{trigger_value}` to dynamically insert the diagnosis or tariff code that triggered the follow-up
- This saves time and ensures consistent documentation

**Examples**:
```
"Follow-up for {trigger_value}. Check healing progress and remove sutures if needed."
→ Becomes: "Follow-up for Tooth Extraction (8104). Check healing progress and remove sutures if needed."

"Post-operative check for {trigger_value}. Assess pain levels and healing."
→ Becomes: "Post-operative check for Root Canal Treatment. Assess pain levels and healing."

"Periodontal maintenance visit following {trigger_value} diagnosis."
→ Becomes: "Periodontal maintenance visit following Chronic Periodontitis diagnosis."
```

### 2. Services to Schedule (Tariff Codes)
**Purpose**: Automatically add specific services/procedures to the follow-up visit invoice.

**How it works**:
- Enter comma-separated tariff codes (e.g., "8101, 8105")
- These services will be automatically added to the follow-up visit
- They appear as line items in the invoice
- Helps ensure proper billing and service tracking

**Examples**:
- **Post-extraction follow-up**: "8101" (Consultation/examination)
- **Periodontal maintenance**: "8105, 8147" (Scaling and polishing)
- **Root canal follow-up**: "8101, 8140" (Examination and X-ray)

**Common Tariff Codes** (varies by practice):
- 8101: Consultation/Examination
- 8104: Tooth Extraction
- 8105: Scaling and Polishing
- 8107: Root Canal Treatment
- 8140: Dental X-ray
- 8147: Deep Cleaning

## Complete Template Example

**Template Name**: Post-Extraction Healing Check
**Trigger Type**: TARIFF_CODE
**Trigger Value**: 8104
**Steps**:
1. **Step 1**:
   - Interval: 7 Days
   - Visit Type: Follow-up
   - Notes Template: "Post-extraction follow-up for {trigger_value}. Check socket healing, assess for dry socket, remove sutures if present. Patient should report any persistent pain or swelling."
   - Services to Schedule: "8101"

When triggered, this creates a follow-up visit:
- Scheduled 7 days after the extraction
- Pre-filled notes explaining the purpose
- Consultation service (8101) automatically added to invoice

## Benefits

1. **Consistency**: All follow-ups have standardized notes
2. **Efficiency**: No need to manually type notes or add services
3. **Billing Accuracy**: Correct services automatically included
4. **Quality Care**: Ensures important follow-ups aren't missed
5. **Customizable**: Each practice can define their own templates

## Tips

- Keep notes templates professional but informative
- Include key things to check during the follow-up
- Only include services that are always needed
- Additional services can be added manually during the visit
- Use clear, descriptive template names