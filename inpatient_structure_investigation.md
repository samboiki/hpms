# Inpatient Module Structure Investigation

## Objective
Understand the correct hierarchy: departments -> wards -> rooms -> beds
Verify table relationships and identify any redundant tables like 'ward_beds'

## Investigation Steps
1. List all tables containing 'bed', 'ward', 'room' keywords
2. Get complete schema for: departments, wards, rooms, beds
3. Verify foreign key relationships
4. Check for 'ward_beds' table existence
5. Analyze the correct bed_allocations query structure

## Status
Starting investigation...
