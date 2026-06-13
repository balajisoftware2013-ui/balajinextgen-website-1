/*
================================================================
BALAJI NEXTGEN ERP
F016 - VALIDATION UTILS
Form validation helpers for all ERP forms.
================================================================
*/

const ValidationUtils = {

    required(val, fieldName = "Field") {
        if (!val || String(val).trim() === "") return fieldName + " is required";
        return null;
    },

    email(val) {
        if (!val) return "Email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Invalid email address";
        return null;
    },

    mobile(val) {
        if (!val) return "Mobile number is required";
        if (!/^[6-9]\d{9}$/.test(val)) return "Enter a valid 10-digit Indian mobile number";
        return null;
    },

    gst(val) {
        if (!val) return null; // Optional field
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val))
            return "Invalid GST number format";
        return null;
    },

    pan(val) {
        if (!val) return null;
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) return "Invalid PAN format";
        return null;
    },

    pincode(val) {
        if (!val) return null;
        if (!/^[1-9][0-9]{5}$/.test(val)) return "Invalid 6-digit PIN code";
        return null;
    },

    number(val, min = null, max = null) {
        if (val === "" || val === null || val === undefined) return "Enter a number";
        if (isNaN(val)) return "Must be a valid number";
        if (min !== null && Number(val) < min) return "Minimum value is " + min;
        if (max !== null && Number(val) > max) return "Maximum value is " + max;
        return null;
    },

    password(val) {
        if (!val) return "Password is required";
        if (val.length < 4) return "Minimum 4 characters required";
        return null;
    },

    /* ============================================================
       VALIDATE FORM — pass an object of {fieldName: value}
       and a rules object {fieldName: "required|email|mobile"}
    ============================================================ */

    validateForm(fields, rules) {
        const errors = {};
        Object.entries(rules).forEach(([field, ruleStr]) => {
            const val = fields[field];
            const ruleList = ruleStr.split("|");
            for (const rule of ruleList) {
                let err = null;
                if (rule === "required") err = this.required(val, field);
                else if (rule === "email")  err = this.email(val);
                else if (rule === "mobile") err = this.mobile(val);
                else if (rule === "number") err = this.number(val);
                if (err) { errors[field] = err; break; }
            }
        });
        return errors;
    },

    /* ============================================================
       SHOW ERRORS in form
    ============================================================ */

    showErrors(errors) {
        // Clear old errors
        document.querySelectorAll(".erp-field-error").forEach(el => el.remove());

        Object.entries(errors).forEach(([field, msg]) => {
            const input = document.getElementById(field) ||
                          document.querySelector(`[name="${field}"]`);
            if (input) {
                const err = document.createElement("div");
                err.className = "erp-field-error";
                err.style.cssText = "color:#dc2626;font-size:12px;margin-top:4px";
                err.textContent = msg;
                input.parentNode.appendChild(err);
                input.style.borderColor = "#dc2626";
            }
        });

        if (Object.keys(errors).length > 0) {
            const first = Object.keys(errors)[0];
            const el = document.getElementById(first);
            if (el) el.focus();
        }
    }

};

/* Global shorthand */
function validateForm(fields, rules) { return ValidationUtils.validateForm(fields, rules); }

console.log("[VALIDATION UTILS] Loaded");
