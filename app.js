const baseSampleRows = [
  { date: "2026-04-01", region: "Seoul", product: "Alpha", sales: 128, revenue: 12200, satisfaction: 4.3 },
  { date: "2026-04-02", region: "Busan", product: "Alpha", sales: 98, revenue: 9100, satisfaction: 4.1 },
  { date: "2026-04-03", region: "Seoul", product: "Beta", sales: 156, revenue: 14900, satisfaction: 4.6 },
  { date: "2026-04-04", region: "Incheon", product: "Gamma", sales: 84, revenue: 7600, satisfaction: 3.9 },
  { date: "2026-04-05", region: "Daegu", product: "Beta", sales: 142, revenue: 13800, satisfaction: 4.5 },
  { date: "2026-04-06", region: "Busan", product: "Gamma", sales: 76, revenue: 6800, satisfaction: 3.8 },
  { date: "2026-04-07", region: "Seoul", product: "Alpha", sales: 164, revenue: 15800, satisfaction: 4.7 }
];

function getRandomizedSampleRows() {
  return baseSampleRows.map(row => {
    const newRow = { ...row };
    if (typeof newRow.sales === 'number') newRow.sales = Math.floor(Math.random() * 200) + 50;
    if (typeof newRow.revenue === 'number') newRow.revenue = newRow.sales * (Math.floor(Math.random() * 50) + 80);
    if (typeof newRow.satisfaction === 'number') newRow.satisfaction = Number((Math.random() * 2 + 3).toFixed(1));
    return newRow;
  });
}

let currentSampleRows = getRandomizedSampleRows();

const els = {
  fileInput: document.getElementById("fileInput"),
  dropzone: document.getElementById("dropzone"),
  fileMeta: document.getElementById("fileMeta"),
  summaryCards: document.getElementById("summaryCards"),
  insightText: document.getElementById("insightText"),
  chartArea: document.getElementById("chartArea"),
  tablePreview: document.getElementById("tablePreview"),
  samplePreview: document.getElementById("samplePreview"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  resetBtn: document.getElementById("resetBtn")
};

init();

function init() {
  if (els.fileInput) {
    els.fileInput.addEventListener("change", async (event) => {
      const [file] = event.target.files;
      if (file) await handleFile(file);
    });
  }

  if (els.dropzone) {
    ["dragenter", "dragover"].forEach((type) => {
      els.dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        els.dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((type) => {
      els.dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        els.dropzone.classList.remove("dragover");
      });
    });

    els.dropzone.addEventListener("drop", async (event) => {
      event.preventDefault();
      const [file] = event.dataTransfer.files;
      if (file) {
        els.fileInput.files = event.dataTransfer.files;
        await handleFile(file);
      }
    });
  }

  if (els.loadSampleBtn) {
    els.loadSampleBtn.addEventListener("click", () => {
      currentSampleRows = getRandomizedSampleRows();
      analyzeData(currentSampleRows, "sample-dataset.json");
      renderSamplePreview("json");
    });
  }

  if (els.resetBtn) {
    els.resetBtn.addEventListener("click", resetDashboard);
  }

  document.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      const format = button.dataset.format;
      currentSampleRows = getRandomizedSampleRows();
      renderSamplePreview(format);
      downloadSample(format);
    });
  });

  renderSamplePreview("csv");
}

async function handleFile(file) {
  try {
    els.fileMeta.textContent = `${file.name} ( ${(file.size / 1024).toFixed(1)} KB )`;
    const rows = await parseFile(file);
    analyzeData(rows, file.name);
  } catch (error) {
    console.error("File Handling Error:", error);
    showError(`파일 처리 오류: ${error.message}`);
  }
}

async function parseFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "csv") return parseCsv(await file.text());
  if (extension === "xlsx") return parseXlsx(await file.arrayBuffer());
  if (extension === "json") return parseJson(await file.text());
  if (extension === "xml") return parseXml(await file.text());
  throw new Error("지원하지 않는 파일 형식입니다.");
}

function parseCsv(text) {
  const workbook = XLSX.read(text, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function parseJson(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.data)) return parsed.data;
  throw new Error("JSON 형식이 올바르지 않습니다.");
}

function parseXml(text) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "application/xml");
  const records = [...xmlDoc.querySelectorAll("record, row, item")];
  if (!records.length) throw new Error("XML에서 데이터를 찾을 수 없습니다.");
  return records.map((node) => {
    const row = {};
    [...node.children].forEach((child) => {
      row[child.tagName] = child.textContent.trim();
    });
    return row;
  });
}

function analyzeData(rows, sourceName) {
  try {
    const normalizedRows = preprocessRows(rows);
    if (!normalizedRows.length) throw new Error("분석할 수 있는 유효한 데이터가 없습니다.");
    const profile = profileColumns(normalizedRows);
    renderSummary(normalizedRows, profile, sourceName);
    renderInsights(normalizedRows, profile, sourceName);
    renderChart(normalizedRows, profile);
    renderTable(normalizedRows);
  } catch (error) {
    console.error("Analysis Error:", error);
    showError(`분석 오류: ${error.message}`);
  }
}

function preprocessRows(rows) {
  return rows.map(row => {
    const cleaned = {};
    Object.entries(row).forEach(([k, v]) => {
      const key = String(k).trim();
      const val = String(v ?? "").trim();
      if (!val || val.toLowerCase() === "null") cleaned[key] = null;
      else if (!isNaN(val)) cleaned[key] = Number(val);
      else cleaned[key] = val;
    });
    return cleaned;
  }).filter(r => Object.values(r).some(v => v !== null));
}

function profileColumns(rows) {
  const columns = Object.keys(rows[0] || {});
  return columns.map(name => {
    const vals = rows.map(r => r[name]).filter(v => v !== null);
    const nums = vals.filter(v => typeof v === 'number');
    const isDate = vals.length > 0 && vals.every(v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)));
    const uniqueCount = new Set(vals).size;
    return {
      name,
      type: isDate ? "date" : (nums.length >= vals.length * 0.7 ? "number" : "category"),
      nullCount: rows.length - vals.length,
      uniqueCount,
      avg: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
      max: nums.length ? Math.max(...nums) : null
    };
  });
}

function recommendAlgorithm(rows, profile) {
  const nums = profile.filter(p => p.type === "number");
  const cats = profile.filter(p => p.type === "category");
  const dates = profile.filter(p => p.type === "date");

  if (dates.length > 0 && nums.length > 0) return "선형 회귀 (Linear Regression)";
  const binary = cats.find(c => c.uniqueCount === 2);
  if (binary) return "로지스틱 회귀 (Logistic Regression)";
  if (nums.length >= 3) return "K-평균 클러스터링 (K-Means Clustering)";
  if (nums.length === 2) return "다항 회귀 (Polynomial Regression)";
  if (rows.length > 100) return "랜덤 포레스트 (Random Forest)";
  return "의사결정나무 (Decision Tree)";
}

function renderSummary(rows, profile, sourceName) {
  const cards = [
    { label: "총 행 수", value: rows.length.toLocaleString() },
    { label: "결측치 합계", value: profile.reduce((s, c) => s + c.nullCount, 0).toLocaleString() },
    { label: "수치형 컬럼", value: profile.filter(p => p.type === "number").length },
    { label: "날짜형 컬럼", value: profile.filter(p => p.type === "date").length }
  ];
  els.summaryCards.innerHTML = cards.map(c => `<article class="summary-card"><div class="label">${c.label}</div><div class="value">${c.value}</div></article>`).join("");
}

function renderInsights(rows, profile, sourceName) {
  const algorithm = recommendAlgorithm(rows, profile);
  const strongest = [...profile.filter(p => p.type === "number")].sort((a, b) => b.max - a.max)[0];
  
  els.insightText.className = "insight-text";
  els.insightText.innerHTML = `
    <p><strong>${sourceName}</strong> 데이터에서 ${rows.length}개의 유효 행을 발견했습니다.</p>
    ${strongest ? `<p>가장 큰 수치를 보인 지표는 <strong>${strongest.name}</strong>(최대 ${strongest.max.toLocaleString()})입니다.</p>` : ""}
    <p style="margin-top:10px;">💡 데이터 특성상 다음 알고리즘 활용을 권장합니다:</p>
    <p><strong style="font-size: 1.2em; color: #0f766e;">${algorithm}</strong></p>
  `;
}

function renderChart(rows, profile) {
  els.chartArea.innerHTML = "";
  els.chartArea.className = "chart-area";
  const nums = profile.filter(p => p.type === "number");
  const dateCol = profile.find(p => p.type === "date");
  
  const host = document.createElement("div");
  host.style.width = "100%";
  host.style.height = "400px";
  els.chartArea.appendChild(host);

  if (dateCol && nums[0]) {
    const sorted = [...rows].sort((a, b) => String(a[dateCol.name]).localeCompare(String(b[dateCol.name])));
    Plotly.newPlot(host, [{
      x: sorted.map(r => r[dateCol.name]),
      y: sorted.map(r => r[nums[0].name]),
      type: "scatter", mode: "lines+markers", line: { color: "#0f766e" }
    }], { title: `${dateCol.name} 기준 ${nums[0].name} 변화`, paper_bgcolor: "transparent", plot_bgcolor: "transparent" });
  } else if (nums.length >= 2) {
    Plotly.newPlot(host, [{
      x: rows.map(r => r[nums[0].name]),
      y: rows.map(r => r[nums[1].name]),
      mode: "markers", type: "scatter", marker: { color: "#0f766e" }
    }], { title: `${nums[0].name} vs ${nums[1].name}`, paper_bgcolor: "transparent", plot_bgcolor: "transparent" });
  } else {
    els.chartArea.textContent = "시각화할 충분한 데이터가 없습니다.";
    els.chartArea.className = "chart-area empty-state";
  }
}

function renderTable(rows) {
  const cols = Object.keys(rows[0] || {});
  els.tablePreview.className = "table-preview";
  els.tablePreview.innerHTML = `<table><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 10).map(r => `<tr>${cols.map(c => `<td>${r[c] ?? "-"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function showError(msg) {
  els.insightText.textContent = msg;
  els.chartArea.textContent = "오류로 인해 시각화를 표시할 수 없습니다.";
}

function resetDashboard() {
  els.fileInput.value = "";
  els.fileMeta.textContent = "파일이 선택되지 않았습니다.";
  els.summaryCards.innerHTML = "";
  els.insightText.className = "insight-text empty-state";
  els.insightText.textContent = "분석이 시작되면 추천 알고리즘과 인사이트가 여기에 표시됩니다.";
  els.chartArea.innerHTML = "분석된 데이터가 존재하지 않습니다.";
  els.chartArea.className = "chart-area empty-state";
  els.tablePreview.innerHTML = "데이터를 불러오면 표 형식으로 확인 가능합니다.";
  els.tablePreview.className = "table-preview empty-state";
}

function renderSamplePreview(format) {
  const map = {
    csv: toCsv(currentSampleRows),
    json: JSON.stringify(currentSampleRows, null, 2),
    xml: toXml(currentSampleRows),
    xlsx: "XLSX 미리보기는 지원되지 않습니다. 다운로드하여 확인하세요."
  };
  els.samplePreview.textContent = map[format];
}

function downloadSample(format) {
  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(currentSampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, `sample.${format}`);
    return;
  }
  const content = format === "csv" ? toCsv(currentSampleRows) : format === "json" ? JSON.stringify(currentSampleRows, null, 2) : toXml(currentSampleRows);
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sample.${format}`;
  a.click();
}

function toCsv(rows) {
  const heads = Object.keys(rows[0] || {});
  return [heads.join(","), ...rows.map(r => heads.map(h => String(r[h] ?? "").replace(/,/g, "")).join(","))].join("\n");
}

function toXml(rows) {
  return `<dataset>\n${rows.map(r => `  <record>\n${Object.entries(r).map(([k,v]) => `    <${k}>${v}</${k}>`).join("\n")}\n  </record>`).join("\n")}\n</dataset>`;
}
