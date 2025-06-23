# Statement Generation Test Plan

## Test Requirements

### 1. Modal Visibility Test
- [ ] Modal appears above all other elements (z-index priority)
- [ ] Modal renders using React Portal to document.body
- [ ] Backdrop fade effect works properly
- [ ] Modal can be closed by clicking backdrop or X button

### 2. EXACT Invoice Style Matching Test
- [ ] **Logo**: Practice logo appears in top-left (if available)
- [ ] **Practice Name**: Uses Rubik font, 22px, weight 800, color #5f6578
- [ ] **Practice Details**: Right-aligned with address, phone, email, domain
- [ ] **NO Subtitle**: Remove hero_subtitle completely
- [ ] **Title**: "ACCOUNT STATEMENT" instead of "MEDICAL INVOICE"
- [ ] **Patient Section**: "PREPARED FOR" with exact layout as invoice

### 3. Multi-Page Functionality Test
- [ ] **≤ 9 services**: Single page with footer
- [ ] **10-13 services**: 10 on page 1, rest on page 2 with footer
- [ ] **≥ 14 services**: 14 on page 1, then 20 per continuation page
- [ ] **Continuation pages**: Show "SERVICES (CONTINUED)" header
- [ ] **Footer**: Only appears on last page with totals

### 4. Table Structure Test
- [ ] **Columns**: Code, Description, Qty, Service Price, Medical Aid, Patient Portion
- [ ] **Styling**: Same fonts, colors, padding as invoice table
- [ ] **Summary rows**: Subtotal, Patient Portion (orange), Total (dark gray)
- [ ] **Banking details**: Same style as invoice

### 5. Data Accuracy Test
- [ ] All services from filtered invoices included
- [ ] Correct financial calculations
- [ ] Proper date range filtering
- [ ] Invoice numbers linked to services

## Current Issues Found
1. ❌ Using custom styling instead of exact invoice structure
2. ❌ Missing logo display
3. ❌ Missing practice details
4. ❌ Including unwanted subtitle
5. ❌ Multi-page cutting off content

## Fix Plan
1. Replace entire HTML generation with EXACT invoice structure
2. Copy logo, practice details, and styling from invoice code
3. Remove subtitle reference
4. Implement proper multi-page pagination logic
5. Test with various service counts