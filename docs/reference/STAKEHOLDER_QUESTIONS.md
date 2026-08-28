# ATLAS System Design: Stakeholder Clarification Questions

Based on the initial implementation of the ATLAS assignments module and the findings from our recent UX/UI and data audits, the following questions are designed to clarify "grey areas" in operational policy. Answers to these questions will ensure the system accurately reflects on-the-ground realities rather than rigid, hardcoded assumptions.

---

## 1. Workload Limits & DepEd DO 005 Interpretation
*Currently, the algorithm hard-stops at 1,800 minutes (30 hours) for standard load and strictly refuses to exceed 2,400 minutes (40 hours) for an absolute hard cap. We need to understand how the division handles edge cases.*

**1.1 Overload Preference vs. Cross-Assignment**
When faced with a teacher shortage, do you prefer to max out a specialized teacher into an 'Overload' status (e.g., giving a Math teacher 35 hours/week), OR do you prefer to keep them at 30 hours and cross-assign an under-loaded teacher from a different department (e.g., having a MAPEH teacher teach Math)?

**1.2 Advisorship Weighting**
Under your specific Division Office's interpretation, does the time spent as a Class Adviser (and teaching Homeroom Guidance) strictly deduct from their 30-hour academic teaching limit, or is Advisorship counted as a separate administrative duty outside the standard academic calculation?

**1.3 Administrative and Ancillary Loads**
How are other non-teaching loads quantified? For instance, if a teacher is a Department Head, Club Moderator, or Property Custodian, how many "hours" should ATLAS deduct from their maximum assignable teaching capacity?

---

## 2. Specialized Programs (STE/SPA) & Subject Nuances
*We've noticed that ATLAS currently struggles with mapping teachers to strictly "Special Program" subjects (e.g., Advanced Chemistry).*

**2.1 Cross-Pollination of Special Program Teachers**
Are teachers who handle STE or SPA specific subjects exclusive to those programs, or can they be assigned to "Regular" sections if they have spare capacity in their 30-hour workload?

**2.2 Specialization Priority**
If a teacher has a major in Chemistry but is currently handling Regular Science, should the auto-fill algorithm always prioritize pulling them into an STE Advanced Chemistry slot first before giving them Regular Science sections?

---

## 3. Handling the "Modular Science" Shortage
*Algorithm tests indicate massive theoretical shortages if the system attempts to assign Biology, Chemistry, Earth Science, and Physics simultaneously for a single section across the entire year.*

**3.1 Partial Fulfillment Realities**
When there aren't enough Science teachers to cover all four modules for a single section simultaneously, how do you handle this operationally? Do you rely on substitute teachers, drop a module, or merge classes?

**3.2 Quarterly Splitting vs. Year-Round Mapping**
Do teachers handle specific modules for the entire year across different sections, or do you require the system to map assignments on a strict Quarterly basis (e.g., Teacher A teaches Bio to Section 1 in Q1, and Chem to Section 1 in Q2)? 

---

## 4. TLE, Cohort Execution & Room Logistics
*The system architecture supports "Instructional Cohorts" (splitting one section into multiple specialized classes like Cookery and Drafting), but the physical room constraints are not fully defined.*

**4.1 Split-Section Room Logistics (TLE)**
When a Grade 8 section is split for TLE (e.g., 20 students take Cookery, 20 take Drafting), do those two teachers teach at the exact same time in two different physical rooms? Or do they share a single large workshop space/covered court? *(This is critical for the downstream Timetable Generator's room collision logic).*

**4.2 Floating Teachers vs. Owned Homerooms**
Do teachers "own" a specific physical classroom where they stay while different student sections rotate in, or do teachers "float" and travel to the students' designated homerooms? 

**4.3 Building Transition & Travel Time**
If a "floating" teacher is assigned back-to-back classes in different buildings (e.g., Main Academic Building followed immediately by the TLE Building), what is the minimum acceptable travel time? Should ATLAS explicitly block back-to-back cross-building assignments, or just issue a warning?

**4.4 Specialized Lab Priority**
If multiple sections require the Computer Lab or Science Lab at the same time during timetable generation, how is priority determined? Does the system need a strict booking mechanism, or should it auto-resolve based on grade level (e.g., Grade 10 gets priority over Grade 7)?

---

## 5. Workflow, Drafts & Approvals
*The assignment page acts as a "Command Center" for a scheduling officer, but we need to ensure the system supports the actual human workflow.*

**5.1 Collaboration and Approval Gates**
Is there only ONE master scheduler who does all of this, or do Department Heads (e.g., the Head of Math) need to log into ATLAS, draft, review, and approve the teaching loads for their specific teachers before the master schedule is finalized?

**5.2 The 'Unmapped' HR Catch**
If the EnrollPro HR integration syncs a newly hired teacher, but their specialization string is blank, malformed, or unusual (e.g., "Major in Agri-Fishery"), who is responsible for catching that and mapping them in ATLAS? Does the Scheduling Officer manually override it in ATLAS, or must they send a ticket back to the HR Officer to fix it in EnrollPro?

**5.3 Mid-Year Faculty Changes**
How should the system handle a teacher resigning or going on maternity leave mid-year? Should ATLAS allow "locking" past assignments while opening up specific sections for reassignment to a substitute, or is a completely new schedule generated?

---

## 6. Faculty Room Preferences & Request Workflow
*ATLAS allows faculty to submit specific room requests. We need to define the "Rules of Engagement" for these preferences.*

**6.1 Conflict Resolution Priority**
If two teachers request the same room for the exact same time slot, how should the system prioritize the approval? Is it "First-Come-First-Served," or does the Scheduling Officer want a ranking system based on Seniority or Subject Priority?

**6.2 Scope of Requests**
Are faculty allowed to request *any* room on campus, or should the system restrict them to rooms within their own department's building (e.g., a Science teacher only requesting rooms in the Science & Labs building)?

**6.3 Rejection Feedback & Alternatives**
When a room preference is denied by the Scheduling Officer, should the system simply mark it as "Rejected," or should it prompt the officer to provide a "Suggested Alternative" room that is currently vacant?

**6.4 Request Submission Windows**
Do you prefer a "Lock Period" where faculty can submit requests (e.g., the first two weeks of the semester), or should the room preference portal remain open for rolling requests year-round?

---

## 7. Daily Scheduling Constraints & "Quality of Life"
*Beyond teaching hours, the "shape" of the day impacts faculty well-being and operational efficiency.*

**7.1 Lunch Break Policy**
Do you require a "Unified" lunch break where the entire school stops at the same time, or a "Staggered" break where different grade levels or departments eat at different times to prevent canteen congestion?

**7.2 Idle Time (Gap Periods)**
What is the maximum number of "Gap Periods" (vacant hours between classes) a teacher should have in a single day? Is there a hard requirement to minimize these "dead hours" for teachers?

**7.3 Double Periods & Lab Sessions**
Should the system allow "Double Periods" (scheduling two 50-minute sessions back-to-back for the same subject) to accommodate Science Labs or TLE Workshops, or must subjects always be split across different days?

**7.4 Flag Ceremony & Unified Time Blocks**
Are there specific days (e.g., Monday mornings) where the system must "Hard Lock" a time block for a school-wide event, preventing any academic classes from being scheduled?

---

## 8. Data Integrity, Syncing & Conflicts
*ATLAS is a bridge system. We need to define how "Live" the data needs to be.*

**8.1 Sync Frequency vs. Stability**
If a section's name or student count changes in EnrollPro, should ATLAS update immediately (potentially disrupting an in-progress schedule draft), or should syncs only be triggered manually by the Scheduling Officer?

**8.2 Mid-Generation Data Deletion**
What is the expected behavior if a section or subject is deleted in EnrollPro while ATLAS is in the middle of a "Generation Run"? Should the run abort, or should it finish using the "Snapshot" data from the start of the run?

---

## 9. Post-Generation, Communication & Transparency
*Once the Master Schedule is "Published," how is it communicated?*

**9.1 Notification Channels**
How should faculty be notified that their schedule is ready? Should ATLAS send an automated Email/SMS via the EnrollPro bridge, or is an "In-App" notification sufficient?

**9.2 Personal Schedule Accessibility**
Do faculty need a "Printable PDF" view of their schedule, or is a "Mobile-Responsive" digital view the priority for them to check on their phones between classes?

**9.3 Appeal & Feedback Loop**
Once a schedule is published, is there a formal "Appeal Period" where teachers can contest their schedule within the system, or are all adjustments handled manually/offline by the Scheduling Officer?