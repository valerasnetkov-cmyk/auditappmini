# Data Model

## Vehicle
- id
- number
- name
- status
- created_at

## Inspection
- id
- vehicle_id
- type
- inspector_id
- date
- completed

## Checklist Item
- id
- inspection_id
- title
- result
- comment

## Photo
- id
- inspection_id
- defect_id
- url
- geo
- created_at

## Defect
- id
- inspection_id
- title
- photo_id
- created_at

## User
- id
- name
- role
