/*
================================================================
BALAJI NEXTGEN ERP
F015 - AI SERVICE
AI analytics, smart alerts, and business intelligence.
================================================================
*/

const AIService = {

    /* ============================================================
       AI FORECAST
    ============================================================ */

    async getSalesForecast(period = "NEXT_30_DAYS") {
        return await apiRequest("AI_SALES_FORECAST", {
            period,
            clientId: StorageEngine.getClient(),
            branch:   StorageEngine.getBranch()
        });
    },

    async getInventoryAlert() {
        return await apiRequest("AI_INVENTORY_ALERT", {
            clientId: StorageEngine.getClient()
        });
    },

    async getSmartInsights() {
        return await apiRequest("AI_SMART_INSIGHTS", {
            clientId: StorageEngine.getClient()
        });
    },

    async getTopItems(limit = 10) {
        return await apiRequest("AI_TOP_ITEMS", {
            limit,
            clientId: StorageEngine.getClient()
        });
    },

    /* ============================================================
       RENDER AI INSIGHT CARD
    ============================================================ */

    renderInsightCard(containerId, insights = []) {

        const el = document.getElementById(containerId);
        if (!el) return;

        if (!insights.length) {
            el.innerHTML = `<p style="color:#94a3b8;text-align:center">No AI insights available</p>`;
            return;
        }

        el.innerHTML = insights.map(item => `
            <div class="ai-insight-card">
                <div class="ai-icon">${item.icon || "🤖"}</div>
                <div class="ai-content">
                    <div class="ai-title">${item.title}</div>
                    <div class="ai-desc">${item.description}</div>
                </div>
                <div class="ai-score ${item.score >= 70 ? 'positive' : 'neutral'}">${item.score || ""}%</div>
            </div>
        `).join("");

    }

};

console.log("[AI SERVICE] Loaded");
