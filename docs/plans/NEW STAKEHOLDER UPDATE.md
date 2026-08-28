To properly compare the previous system design to the new **Master Implementation Plan**, you need the exact rationale behind every architectural pivot.

When building enterprise software, developers often build for the "ideal" scenario. The answers we gathered from your stakeholder revealed the "messy" reality of how a Philippine public high school actually operates.

Here is the complete context and rationale for why we changed the system, structured as **Old Assumption vs. New Reality**.

---

### 1. The Curriculum & Labor Constraints

*These changes ensure the system is legally compliant and mathematically sound based on recent DepEd mandates.*

**The Tri-Sem Shift (DepEd DO 009, s. 2026)**

* **Old Assumption:** The school year is divided into 4 Quarters. Science consists of 4 modules (Bio, Chem, Physics, Earth Science) rotating quarterly.
* **New Reality:** DepEd explicitly mandated a Three-Term (Tri-Sem) calendar starting SY 2026-2027.
* **The "Why":** If we left the Timetable Generator looking for 4 modules, it would mathematically fail to generate a schedule that fits into a 3-term year. We had to change the `modularGroupId` bundle from a 4-part to a 3-part transaction and output three distinct schedule layers (Term 1, Term 2, Term 3).

**Ancillary Loads as Read-Only Sync**

* **Old Assumption:** The scheduling officer would manually type in the teaching load deductions (e.g., Department Head = -1 hour/day) inside ATLAS.
* **New Reality:** EnrollPro acts as the ultimate HR source of truth, and these deductions are already logged there.
* **The "Why":** If we allow ATLAS to edit HR data, we create a "split-brain" database where EnrollPro says one thing and ATLAS says another. By making it a read-only sync, we maintain data integrity and save the scheduler from doing double data entry.

---

### 2. The Physical Space & Time Constraints

*These changes prevent the Timetable Generator from crashing over impossible room logistics and align the algorithm with the school's ongoing construction.*

**Dropping Universal Room Logistics for "Home Rooms"**

* **Old Assumption:** ATLAS needed to find an available Teacher, an available Time, *and* an available physical Room for every single class (including TLE splits).
* **New Reality:** Students stay in their rooms, teachers move. Specialized labs (like the Kitchen or Gym) are either managed on the fly by teachers or handled via a separate room booking system.
* **The "Why":** Forcing the algorithm to map a room for every class is an NP-Hard math problem that causes generator gridlock. By assuming 90% of classes happen in the section's static "Home Room," the algorithm runs 10x faster. We only explicitly lock down "Singletons" (like the Gym) where double-booking would cause actual physical chaos.

**The Shift Grids & Zone Transitions**

* **Old Assumption:** All sections are available to be scheduled from 7:00 AM to 5:00 PM. Teachers can walk anywhere on campus instantly.
* **New Reality:** Due to construction, Grades 7/8 are AM only (06:00-12:00), Grades 9/10 are PM only (12:00-17:00), and STE overlaps them (10:00-17:00). Furthermore, STE and Special Programs have isolated buildings.
* **The "Why":** Without hard "Shift Fences," the algorithm would schedule Grade 7 classes at 3:00 PM, creating an illegal schedule. Without the "Minimize Zone Transitions" soft constraint, the algorithm would schedule a teacher in the Main Building at 8:00 AM, the STE Building at 9:00 AM, and back to the Main Building at 10:00 AM, physically exhausting the staff.

---

### 3. The Operational & Human Constraints

*These changes accommodate how the schedulers actually do their jobs, collaborating with each other and HR.*

**The "Teacher X" (Placeholder Faculty) Feature**

* **Old Assumption:** Every teacher on the schedule exists in the EnrollPro HR database. If you are short on Science teachers, the algorithm just leaves the class blank ("Lacking Faculty").
* **New Reality:** The school does not drop modules or merge classes when short-staffed. They hire temporary/substitute teachers (TBA) or pull from the Senior High School (SHS).
* **The "Why":** HR cannot sync a teacher into EnrollPro who hasn't been hired yet. Schedulers need a way to block out 30 hours of work for a "Ghost" teacher so the schedule is completely finished on paper. When the real human is hired two weeks later, they just swap the names.

**Concurrency & Draft PDF Exports**

* **Old Assumption:** One master scheduler sits at a computer and builds the entire school schedule solo.
* **New Reality:** Four Grade Level Coordinators schedule simultaneously in the system, but Department Heads (who aren't in the system) hold the actual approval authority.
* **The "Why":** If four people edit the same database table at the same time, you get race conditions (two people assigning the same Science teacher simultaneously). WebSockets/Presence flags prevent this safely. Furthermore, since Department Heads don't use ATLAS, the Coordinators *must* be able to export a clean PDF draft to walk over to the Department Head's desk for a physical signature before publishing.

### Summary

If you compare the old PRD to the new one, the overarching theme is **Resilience**. The old system tried to be a rigid dictator (forcing room assignments, locking workflows). The new system acts as an **Intelligent Assistant**—it strictly enforces DepEd time and labor laws, but leaves physical space and human collaboration flexible enough to handle the daily chaos of a real high school.