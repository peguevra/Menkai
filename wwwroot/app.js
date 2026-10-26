(() => {
    "use strict";

    let selectedFacility = "すべて";
    let allReservations = [];

    const dateInput = document.getElementById("selectedDate");
    const form = document.getElementById("reservationForm");
    const formMessage = document.getElementById("formMessage");
    const listMessage = document.getElementById("listMessage");
    const reservationList = document.getElementById("reservationList");
    const reservationCount = document.getElementById("reservationCount");
    const submitButton = document.getElementById("submitButton");

    function localToday() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function setMessage(element, message, type = "") {
        element.textContent = message;
        element.className = "message" + (type ? ` ${type}` : "");
    }

    async function readError(response) {
        try {
            const data = await response.json();
            return data.message || `通信エラー (${response.status})`;
        } catch {
            return `通信エラー (${response.status})`;
        }
    }

    async function loadReservations() {
        const date = dateInput.value;

        if (!date) {
            reservationCount.textContent = "—";
            setMessage(listMessage, "表示日を選択してください。", "error");
            return;
        }

        reservationCount.textContent = "…";
        setMessage(listMessage, "");
        reservationList.replaceChildren();

        try {
            const response = await fetch(
                `/api/reservations?date=${encodeURIComponent(date)}`,
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            allReservations = await response.json();
            renderReservations();
        } catch (error) {
            reservationCount.textContent = "—";
            setMessage(
                listMessage,
                `予約一覧を読み込めませんでした。\n${error.message}`,
                "error"
            );
        }
    }

    function addTextElement(parent, tagName, className, text) {
        const element = document.createElement(tagName);
        element.className = className;
        element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function renderReservations() {
        reservationList.replaceChildren();

        const filtered = allReservations.filter(item =>
            selectedFacility === "すべて" ||
            item.facility === selectedFacility
        );

        reservationCount.textContent = String(filtered.length);

        if (filtered.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty";
            addTextElement(empty, "span", "empty-symbol", "○");
            addTextElement(empty, "div", "", "この日の予約はありません。");
            addTextElement(empty, "div", "", "必要な場合は「予約を登録」から追加できます。");
            reservationList.appendChild(empty);
            return;
        }

        for (const item of filtered) {
            const card = document.createElement("article");
            card.className = "reservation-card";

            const timeBlock = document.createElement("div");
            timeBlock.className = "time-block";
            addTextElement(timeBlock, "div", "visit-time", item.time);
            addTextElement(timeBlock, "div", "time-caption", "VISIT TIME");
            card.appendChild(timeBlock);

            const details = document.createElement("div");
            details.className = "reservation-details";

            addTextElement(
                details,
                "div",
                "resident-name",
                `入所者：${item.residentName} 様`
            );

            addTextElement(
                details,
                "div",
                "booker-line",
                `予約者：${item.bookerName} ・ 面会人数：${item.visitorCount}名`
            );

            addTextElement(
                details,
                "div",
                "facility-line",
                `事業所：${item.facility}`
            );

            if (item.detail && item.detail.trim()) {
                addTextElement(details, "div", "detail-line", `詳細：${item.detail}`);
            }

            card.appendChild(details);

            const statusButton = document.createElement("button");
            statusButton.type = "button";
            statusButton.className =
                "status-button" + (item.isDone ? " done" : "");
            statusButton.textContent = item.isDone ? "済" : "未";
            statusButton.setAttribute(
                "aria-label",
                `${item.residentName}様の実施状況を${item.isDone ? "未に戻す" : "済にする"}`
            );
            statusButton.setAttribute("aria-pressed", String(item.isDone));
            statusButton.addEventListener(
                "click",
                () => toggleStatus(item, statusButton)
            );

            card.appendChild(statusButton);
            reservationList.appendChild(card);
        }
    }

    async function toggleStatus(item, button) {
        button.disabled = true;

        try {
            const response = await fetch(
                `/api/reservations/${item.id}/status`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isDone: !item.isDone })
                }
            );

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            item.isDone = !item.isDone;
            setMessage(listMessage, "");
            renderReservations();
        } catch (error) {
            setMessage(
                listMessage,
                `実施状況を更新できませんでした。\n${error.message}`,
                "error"
            );
            button.disabled = false;
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        setMessage(formMessage, "");

        if (!dateInput.value) {
            setMessage(formMessage, "先に表示日を選択してください。", "error");
            return;
        }

        const visitorCount = Number(
            document.getElementById("visitorCount").value
        );

        if (
            !Number.isInteger(visitorCount) ||
            visitorCount < 1 ||
            visitorCount > 100
        ) {
            setMessage(
                formMessage,
                "面会人数は1～100名で入力してください。",
                "error"
            );
            return;
        }

        const payload = {
            date: dateInput.value,
            time: document.getElementById("visitTime").value,
            residentName: document.getElementById("residentName").value.trim(),
            bookerName: document.getElementById("bookerName").value.trim(),
            visitorCount,
            facility: document.getElementById("facility").value,
            detail: document.getElementById("detail").value.trim()
        };

        if (!payload.residentName || !payload.bookerName || !payload.time) {
            setMessage(formMessage, "必須項目を入力してください。", "error");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "登録中…";

        try {
            const response = await fetch("/api/reservations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(await readError(response));
            }

            setMessage(formMessage, "予約を登録しました。", "success");

            form.reset();
            document.getElementById("visitorCount").value = "1";
            document.getElementById("facility").value = "信愛苑";

            await loadReservations();
        } catch (error) {
            setMessage(
                formMessage,
                `登録できませんでした。\n${error.message}`,
                "error"
            );
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "＋ 予約を登録";
        }
    });

    dateInput.addEventListener("change", () => {
        setMessage(formMessage, "");
        loadReservations();
    });

    document.getElementById("todayButton").addEventListener("click", () => {
        dateInput.value = localToday();
        setMessage(formMessage, "");
        loadReservations();
    });

    document.getElementById("reloadButton").addEventListener("click", loadReservations);

    document.getElementById("facilityFilters").addEventListener("click", event => {
        const button = event.target.closest("button[data-facility]");
        if (!button) return;

        selectedFacility = button.dataset.facility;

        document.querySelectorAll(".filter-button").forEach(filterButton => {
            const active = filterButton.dataset.facility === selectedFacility;
            filterButton.classList.toggle("active", active);
            filterButton.classList.toggle("btn-primary", active);
            filterButton.classList.toggle("btn-outline-secondary", !active);
            filterButton.setAttribute("aria-pressed", String(active));
        });

        renderReservations();
    });

    dateInput.value = localToday();
    loadReservations();
})();
