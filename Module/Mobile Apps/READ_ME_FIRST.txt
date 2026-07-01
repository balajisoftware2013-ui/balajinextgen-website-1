HOW TO OPEN THIS APP (do this, not double-clicking the .html file)
====================================================================
Double-click:  Start_Balaji_Business_OS.bat

This starts a tiny local web server on your PC and opens the app in your
browser at http://localhost:8765/balaji-business-os.html — that is what
makes login, registration, and cloud save/sync actually work.

Opening balaji-business-os.html directly (file:///...) will NEVER be able
to log in or save, no matter what — that is a Chrome/Edge security rule,
not a bug in the app. The .bat file is the fix, and it works from desktop
like a normal app (keep it, and this whole folder, together).

Requires Python to be installed once (https://www.python.org/downloads/,
tick "Add to PATH" during install). Most Windows PCs from IT/software
shops already have it. If not, the .bat file will tell you.

WHAT CHANGED IN THIS PASS
====================================================================
1. Fixed a crash on first-time dashboard load ("Cannot read properties of
   undefined reading 'name'") that happened when a brand-new account had
   zero items yet.
2. Bank sheet: added multiple named bank accounts + real Bank-to-Bank
   transfer (previously "Contra" was just a text note, no actual balance
   movement).
3. "+ Start New Sale" button is now centered and larger on the dashboard.
4. The red file:// warning bar is now small, dismissible, and tells you
   to use the .bat launcher instead of just complaining.
5. Added this launcher (Start_Balaji_Business_OS.bat) for a proper
   desktop double-click experience.

STILL IN THE QUEUE (next passes)
====================================================================
- Purchase entry rework (supplier search + quick add, right-aligned items panel)
- Day Closing cash counting with notes
- Invoice formats (Simple / Detailed / Custom) + POS print size
- Stock Movement & Ledger reports
- Party-wise monthly pivot report with drill-down
- Report export with company name/address letterhead
