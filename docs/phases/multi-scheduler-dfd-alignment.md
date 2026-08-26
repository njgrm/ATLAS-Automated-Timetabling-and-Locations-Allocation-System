# Multi-Scheduler DFD Alignment (Post-Timetable Finalization)

## Purpose

This document captures the agreed target-state DFD revisions for ATLAS after timetable page stabilization, so implementation can proceed toward multi-scheduler collaboration without losing planning context.

## Finalized Planning Decisions

- Target model reflects final desired system behavior, not only currently implemented scope.
- EnrollPro remains an independent external system and is modeled as an external entity feeding faculty and section/curriculum source data into ATLAS.
- `System Administrator` and `Academic Scheduler` remain separate roles.
- System Admin will manage scheduler account distribution and grade-level ownership scopes.
- Schedulers may operate outside assigned scope only through warning + explicit override confirmation.
- Live placement collisions should use warning + confirm and require accept/reject by the scheduler that owns the conflicting placement.
- Partial generation is supported even when all scheduler scopes are not yet fully finalized.
- Publication is scheduler-owned; no System Admin approval step is required for publish.
- Students are unauthenticated, read-only consumers of published schedules.

## DFD Revision Summary

### What changed from prior DFD drafts

- Added explicit external boundary and data dependency for EnrollPro.
- Added collaborative drafting and scheduler scope governance.
- Added negotiation flow for cross-scheduler placement conflicts (accept/reject).
- Added partial-generation path before full finalization.
- Preserved public read-only student access to published schedules.

### New/Updated Logical Data Stores

- `D1 user_accounts`
- `D2 system_settings`
- `D3 academic_resources`
- `D4 constraint_parameters`
- `D5 faculty_preferences`
- `D6 collaborative_drafts`
- `D7 published_master_schedule`
- `D8 scheduler_scope_assignments`
- `D9 conflict_negotiation_log` (proposed for cross-scheduler accept/reject traceability)

## DFD Level 0 (Target-State Context Diagram, Revised to Match Existing Document Style)

The diagram below keeps the same logic and presentation style as the approved Level 0 artifact:

- External actors on both sides
- Single central process `0`
- Labeled data flows between actors and process
- No internal decomposition at this level
- EnrollPro shown as external dependency feeding ATLAS

### Level 0 Mermaid (Style-Matched Revision)

```mermaid
flowchart LR
    subgraph LEFT[ ]
        direction TB
        SA[System Administrator]
        SCH[Academic Scheduler]
        EP[EnrollPro External SIS]
    end

    subgraph CENTER[ ]
        direction TB
        P0["0<br/>A.T.L.A.S. (Automated Timetabling and Locations Allocation System):<br/>A Web-Based Academic Scheduling Application"]
    end

    subgraph RIGHT[ ]
        direction TB
        FAC[Teacher / Faculty]
        STU[Student]
    end

    SA -->|User Account Data and Scheduler Scope Assignment| P0
    SA -->|System Configurations| P0
    P0 -->|System Status Logs| SA

    SCH -->|Academic Resource Data| P0
    SCH -->|Priority Constraints| P0
    SCH -->|Manual Override Data with Scope Warning/Confirm| P0
    SCH -->|Collaborative Draft Inputs and Draft Submissions by Scope| P0
    P0 -->|Draft Timetable and Partial Generation Output| SCH
    P0 -->|Final Master Schedule| SCH

    FAC -->|Faculty Credentials| P0
    FAC -->|Availability and Preference Data| P0
    P0 -->|Synchronized Faculty Schedule| FAC

    STU -->|Section Query| P0
    P0 -->|Published Real-time Section Schedule (Read-Only)| STU

    EP -->|Faculty Source Sync| P0
    EP -->|Section and Curriculum Source Sync| P0
```



## DFD Level 1 (Target-State Functional Decomposition, Draw.io-Style Aligned)

The diagram below mirrors your actual Level 1 structure:

- Actors on the left
- Vertical process stack `P1.0` to `P8.0` in the center
- Data stores on the right
- Process-to-process flow down the stack

```mermaid
flowchart LR
    subgraph L[ ]
        direction TB
        SA[System Administrator]
        SCH[Academic Scheduler]
        FAC[Teacher / Faculty]
        STU[Student]
        EP[EnrollPro External SIS]
    end

    subgraph P[ ]
        direction TB
        P1[P1.0<br/>User Authentication and Scheduler Scope Governance]
        P2[P2.0<br/>Manage System Settings]
        P3[P3.0<br/>Manage Academic Resources]
        P4[P4.0<br/>Configure Priority Parameters]
        P5[P5.0<br/>Process Faculty Preferences]
        P6[P6.0<br/>Collaborative Draft and Partial/Full Generation]
        P7[P7.0<br/>Manual Schedule Refinement and Conflict Negotiation]
        P8[P8.0<br/>Data Synchronization and Distribution]
    end

    subgraph D[ ]
        direction TB
        D1[(D1 user_accounts)]
        D2[(D2 system_settings)]
        D3[(D3 academic_resources)]
        D4[(D4 constraint_parameters)]
        D5[(D5 faculty_preferences)]
        D6[(D6 collaborative_drafts)]
        D7[(D7 master_schedule)]
        D8[(D8 scheduler_scope_assignments)]
        D9[(D9 conflict_negotiation_log)]
    end

    %% actor -> process flows (left side)
    SA --> P1
    SA --> P2
    SCH --> P3
    SCH --> P4
    FAC --> P5
    SCH --> P6
    SCH --> P7
    STU --> P8
    EP -->|Faculty source sync| P3
    EP -->|Section/curriculum source sync| P3

    %% process chain (center)
    P1 --> P2
    P2 --> P3
    P3 --> P4
    P4 --> P5
    P5 --> P6
    P6 --> P7
    P7 --> P8

    %% process <-> datastore flows (right side)
    P1 <--> D1
    P1 <--> D8
    P2 <--> D2
    P3 <--> D3
    P4 <--> D4
    P5 <--> D5
    P6 <--> D6
    P7 <--> D6
    P7 <--> D9
    P8 <--> D7

    %% published outputs
    P8 -->|Synchronized faculty schedule| FAC
    P8 -->|Published real-time section schedule (read-only)| STU
```



## System vs DFD Gap (Implementation Backlog)

- Scheduler account creation and grade-scope assignment UI/API are still pending.
- Multi-scheduler live collaboration and cross-scheduler accept/reject conflict negotiation are pending.
- Partial-generation controls and scope-selection policy are pending.
- Publish is currently in-progress within broader phase sequencing and must be aligned to scheduler-owned publish rule.

## Revisit Checklist (After Timetable Finalization)

- Confirm timetable workspace stability and regression baseline.
- Define final scope model: per grade, per section-group, or hybrid.
- Define negotiation SLA and fallback behavior for unresolved cross-scheduler conflicts.
- Define partial-generation output labeling in UI and audit logs.
- Lock API contracts for scheduler scopes, override actions, and conflict negotiation events.

