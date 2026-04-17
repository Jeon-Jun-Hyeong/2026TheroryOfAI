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
  return rows
    .map((row) => {
      const cleaned = {};
      Object.entries(row).forEach(([key, value]) => {
        cleaned[String(key).trim()] = normalizeValue(value);
      });
      return cleaned;
    })
    .filter((row) => Object.values(row).some((value) => value !== null));
}

function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "null" || raw.toLowerCase() === "n/a") return null;
  const numberCandidate = raw.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numberCandidate)) return Number(numberCandidate);
  const parsedTime = Date.parse(raw);
  if (!Number.isNaN(parsedTime) && /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(raw)) {
    return new Date(parsedTime).toISOString().slice(0, 10);
  }
  return raw;
}

function profileColumns(rows) {
  const columns = Object.keys(rows[0] || {});
  return columns.map((name) => {
    const values = rows.map((row) => row[name]).filter((value) => value !== null);
    const numericValues = values.filter((value) => typeof value === "number");
    const uniqueCount = new Set(values.map((value) => JSON.stringify(value))).size;
    const isDate = values.length > 0 && values.every((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
    const type = isDate ? "date" : numericValues.length >= Math.max(3, values.length * 0.7) ? "number" : "category";
    return {
      name,
      type,
      nullCount: rows.length - values.length,
      uniqueCount,
      min: type === "number" ? Math.min(...numericValues) : null,
      max: type === "number" ? Math.max(...numericValues) : null,
      avg: type === "number" ? average(numericValues) : null
    };
  });
}

function recommendAlgorithm(rows, profile) {
  const numericColumns = profile.filter((column) => column.type === "number");
  const categoryColumns = profile.filter((column) => column.type === "category");
  const dateColumn = profile.find((column) => column.type === "date");

  if (dateColumn && numericColumns.length > 0) {
    return {
      name: "시계열 선형 회귀 (Linear Regression)",
      reason: `${dateColumn.name}처럼 시간 축이 있고 수치형 열이 있어, 시작점 대비 변화 추세를 설명하고 예측하기에 적합합니다.`
    };
  }

  if (numericColumns.length >= 3) {
    return {
      name: "K-평균 클러스터링 (K-Means Clustering)",
      reason: "수치형 열이 여러 개라서 비슷한 패턴의 행을 군집으로 묶어 데이터 구조를 빠르게 파악할 수 있습니다."
    };
  }

  if (categoryColumns.length > 0 && numericColumns.length > 0) {
    return {
      name: "의사결정나무 (Decision Tree)",
      reason: "범주형 조건과 수치형 결과를 함께 해석하기 쉬워, 그룹별 차이를 설명하는 분석에 적합합니다."
    };
  }

  if (rows.length > 100) {
    return {
      name: "랜덤 포레스트 (Random Forest)",
      reason: "데이터가 비교적 많아질수록 여러 규칙을 조합하는 앙상블 방식이 안정적인 성능을 내기 좋습니다."
    };
  }

  return {
    name: "의사결정나무 (Decision Tree)",
    reason: "데이터 구조가 단순할 때도 해석이 쉬워, 기본 추천 모델로 활용하기 좋습니다."
  };
}

function renderSummary(rows, profile, sourceName) {
  const missingCells = profile.reduce((sum, column) => sum + column.nullCount, 0);
  const cards = [
    { label: "행 수", value: rows.length.toLocaleString() },
    { label: "열 수", value: profile.length.toLocaleString() },
    { label: "결측 셀", value: missingCells.toLocaleString() },
    { label: "수치형 열", value: profile.filter((column) => column.type === "number").length.toLocaleString() },
    { label: "날짜형 열", value: profile.filter((column) => column.type === "date").length.toLocaleString() }
  ];
  els.summaryCards.innerHTML = cards
    .map((card) => `<article class="summary-card"><div class="label">${card.label}</div><div class="value">${card.value}</div></article>`)
    .join("");
}

function renderInsights(rows, profile, sourceName) {
  const numericColumns = profile.filter((column) => column.type === "number");
  const categoryColumns = profile.filter((column) => column.type === "category");
  const dateColumn = profile.find((column) => column.type === "date");
  const strongestMetric = [...numericColumns].sort((left, right) => (right.max ?? 0) - (left.max ?? 0))[0];
  const totalCells = rows.length * profile.length;
  const missingCells = profile.reduce((sum, column) => sum + column.nullCount, 0);
  const completeness = totalCells > 0 ? ((totalCells - missingCells) / totalCells) * 100 : 0;
  const algorithm = recommendAlgorithm(rows, profile);

  const insightBlocks = [
    `<strong>${sourceName}</strong> 데이터에서 ${rows.length}행과 ${profile.length}열을 분석했습니다.`,
    `데이터 완전성은 <strong>${completeness.toFixed(1)}%</strong>이며, 결측 셀은 총 <strong>${missingCells.toLocaleString()}</strong>개입니다.`,
    strongestMetric ? `<strong>${strongestMetric.name}</strong> 열의 평균은 <strong>${formatNumber(strongestMetric.avg)}</strong>이고 최댓값은 <strong>${formatNumber(strongestMetric.max)}</strong>입니다.` : "수치형 열이 적어 평균과 최댓값 요약은 제한적입니다.",
    categoryColumns[0] && strongestMetric ? buildCategoryInsight(rows, categoryColumns[0].name, strongestMetric.name) : "범주형 열이 부족해 그룹별 평균 비교는 생략했습니다.",
    dateColumn && strongestMetric ? buildTrendInsight(rows, dateColumn.name, strongestMetric.name) : "날짜형 열이 부족해 시작점 대비 추세 변화는 생략했습니다.",
    `<strong>권장 알고리즘: ${algorithm.name}</strong><br />추천 이유: ${algorithm.reason}`
  ];

  els.insightText.className = "insight-text";
  els.insightText.innerHTML = insightBlocks.map((item) => `<p>${item}</p>`).join("");
}

function buildCategoryInsight(rows, categoryKey, valueKey) {
  const grouped = groupAverage(rows, categoryKey, valueKey);
  if (!grouped.length) return "그룹별 평균 비교를 위한 데이터가 충분하지 않습니다.";
  const top = grouped[0];
  const bottom = grouped[grouped.length - 1];
  return `${categoryKey} 기준으로 보면 <strong>${top.label}</strong> 그룹의 ${valueKey} 평균이 <strong>${formatNumber(top.value)}</strong>로 가장 높고, <strong>${bottom.label}</strong> 그룹은 <strong>${formatNumber(bottom.value)}</strong>로 가장 낮습니다.`;
}

function buildTrendInsight(rows, dateKey, valueKey) {
  const sorted = [...rows]
    .filter((row) => row[dateKey] && typeof row[valueKey] === "number")
    .sort((left, right) => String(left[dateKey]).localeCompare(String(right[dateKey])));

  if (sorted.length < 2) return "추세를 설명할 충분한 시계열 데이터가 없습니다.";
  const firstValue = sorted[0][valueKey];
  const lastValue = sorted[sorted.length - 1][valueKey];
  const delta = lastValue - firstValue;
  const direction = delta > 0 ? "상승" : delta < 0 ? "하락" : "유지";
  return `${dateKey} 흐름에서 ${valueKey}는 시작 지점 대비 <strong>${formatNumber(Math.abs(delta))}</strong>만큼 ${direction}했습니다.`;
}

function groupAverage(rows, categoryKey, valueKey) {
  const store = new Map();
  rows.forEach((row) => {
    const category = row[categoryKey];
    const value = row[valueKey];
    if (category == null || typeof value !== "number") return;
    if (!store.has(category)) store.set(category, []);
    store.get(category).push(value);
  });

  return [...store.entries()]
    .map(([label, values]) => ({ label, value: average(values) }))
    .sort((left, right) => right.value - left.value);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-";
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
