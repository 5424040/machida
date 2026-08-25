// main.js

const MACHIDA = "町田市";

const margin = {
    top: 85,
    right: 70,
    bottom: 65,
    left: 70
};

const dimensions = [
    {
        label: "社会増減",
        value: "socialChange",
        type: "change",
        group: "social",
        year: "2024年",
        title: "社会増減（転入者数 − 転出者数）",
        description: "0より右が転入超過、左が転出超過"
    },
    {
        label: "転入者数",
        value: "moveIn",
        type: "count",
        group: "social",
        year: "2024年",
        title: "転入者数",
        description: "東京都26市の転入者数を比較"
    },
    {
        label: "転出者数",
        value: "moveOut",
        type: "count",
        group: "social",
        year: "2024年",
        title: "転出者数",
        description: "東京都26市の転出者数を比較"
    },
    {
        label: "自然増減",
        value: "naturalChange",
        type: "change",
        group: "natural",
        year: "2023年",
        title: "自然増減（出生数 − 死亡数）",
        description: "0より右が自然増、左が自然減"
    },
    {
        label: "出生数",
        value: "births",
        type: "count",
        group: "natural",
        year: "2023年",
        title: "出生数",
        description: "東京都26市の出生数を比較"
    },
    {
        label: "死亡数",
        value: "deaths",
        type: "count",
        group: "natural",
        year: "2023年",
        title: "死亡数",
        description: "東京都26市の死亡数を比較"
    }
];

let state = dimensions[0];
let displayMode = "count";

let data = [];
let width = 0;
let height = 0;

const xScale = d3.scaleLinear();

const areaScale = d3
    .scaleSqrt()
    .range([7, 23]);

const colorScale = d3
    .scaleOrdinal()
    .domain(["町田市", "その他の市"])
    .range(["#f97316", "#38bdf8"]);


/* =========================
   SVG
========================= */

const container = d3.select("#viewportContainer");

const svg = container
    .append("svg")
    .attr("id", "svgArea");

const zeroLine = svg
    .append("line")
    .attr("class", "zero-line");

const chart = svg
    .append("g");

const axis = svg
    .append("g")
    .attr("class", "axis");

const axisUnit = svg
    .append("g")
    .attr("class", "axis-unit");

const legend = svg
    .append("g")
    .attr("class", "legend");

const tooltip = container
    .append("div")
    .attr("id", "tooltipContainer")
    .style("opacity", 0);


/* =========================
   表示用
========================= */

function formatValue(value) {

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return "-";
    }

    return n.toLocaleString("ja-JP");
}


function formatRate(value) {

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return "-";
    }

    return n.toFixed(1);
}


function formatSigned(value, rate = false) {

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return "-";
    }

    const text = rate
        ? Math.abs(n).toFixed(1)
        : formatValue(Math.abs(n));

    if (n > 0) return `+${text}`;
    if (n < 0) return `−${text}`;

    return rate ? "0.0" : "0";
}


function centerY() {

    return (
        margin.top +
        (height - margin.top - margin.bottom) / 2
    );
}


function cityType(d) {

    return d.municipality === MACHIDA
        ? "町田市"
        : "その他の市";
}


/* =========================
   現在表示する値
========================= */

function getDisplayValue(d) {

    const raw = d[state.value];

    if (displayMode === "rate") {

        if (!d.population) {
            return 0;
        }

        return raw / d.population * 1000;
    }

    return raw;
}


function getUnit() {

    return displayMode === "rate"
        ? "人口1,000人あたり"
        : "人";
}


function formatDisplay(value) {

    if (displayMode === "rate") {

        return state.type === "change"
            ? formatSigned(value, true)
            : formatRate(value);
    }

    return state.type === "change"
        ? formatSigned(value)
        : formatValue(value);
}


/* =========================
   CSV
========================= */

async function loadData() {

    const response = await fetch(
        "assets/data/SSDSE-A-2026.csv"
    );

    if (!response.ok) {
        throw new Error(
            "SSDSE-A-2026.csvを読み込めませんでした"
        );
    }

    const buffer =
        await response.arrayBuffer();

    const text =
        new TextDecoder("shift_jis")
            .decode(buffer);

    const rows =
        d3.csvParseRows(text);

    const header = rows[0];

    const index = {
        population: header.indexOf("A1101"),
        births: header.indexOf("A4101"),
        deaths: header.indexOf("A4200"),
        moveIn: header.indexOf("A5101"),
        moveOut: header.indexOf("A5102")
    };

    if (
        Object.values(index)
            .some(i => i === -1)
    ) {
        throw new Error(
            "CSVに必要なデータがありません"
        );
    }

    data = rows
        .slice(3)

        .filter(row =>
            row[1] === "東京都" &&
            row[2] &&
            row[2].endsWith("市")
        )

        .map(row => {

            const population =
                Number(row[index.population]);

            const births =
                Number(row[index.births]);

            const deaths =
                Number(row[index.deaths]);

            const moveIn =
                Number(row[index.moveIn]);

            const moveOut =
                Number(row[index.moveOut]);

            return {
                municipality: row[2],

                population,
                births,
                deaths,
                moveIn,
                moveOut,

                socialChange:
                    moveIn - moveOut,

                naturalChange:
                    births - deaths
            };
        })

        .filter(d =>
            Number.isFinite(d.population) &&
            Number.isFinite(d.births) &&
            Number.isFinite(d.deaths) &&
            Number.isFinite(d.moveIn) &&
            Number.isFinite(d.moveOut)
        );

    if (!data.length) {
        throw new Error(
            "東京都の市データが見つかりません"
        );
    }
}


/* =========================
   指標切り替え
========================= */

function initControls() {

    const root = d3.select("#variableSelector");


    const controls = root
        .append("form")
        .attr(
            "class",
            "flex flex-wrap items-center justify-center gap-3"
        )
        .selectAll("label")
        .data(
            dimensions,
            d => d.value
        )
        .join("label")
        .attr(
            "class",
            "control-label"
        );


    controls
        .append("input")
        .attr("type", "radio")
        .attr(
            "class",
            "control-radio measure"
        )
        .attr("name", "measure")
        .attr(
            "value",
            d => d.value
        )
        .property(
            "checked",
            d => d.value === state.value
        );


    controls
        .append("span")
        .attr(
            "class",
            "control-chip"
        )
        .text(d => d.label);


    d3.selectAll(".measure")
        .on("change", function(event) {

            state = dimensions.find(
                d =>
                    d.value ===
                    event.currentTarget.value
            );

            update(true);
        });


    /* 人数 / 1000人あたり */

    const modeArea = root
        .append("div")
        .attr(
            "class",
            "mt-5 flex flex-wrap items-center justify-center gap-3"
        );


    modeArea
        .append("span")
        .attr(
            "class",
            "text-sm font-semibold text-slate-600"
        )
        .text("比較方法");


    const modes = [
        {
            label: "人数",
            value: "count"
        },
        {
            label: "人口1,000人あたり",
            value: "rate"
        }
    ];


    const modeLabels = modeArea
        .selectAll("label")
        .data(modes)
        .join("label")
        .attr(
            "class",
            "control-label"
        );


    modeLabels
        .append("input")
        .attr("type", "radio")
        .attr(
            "class",
            "control-radio display-mode"
        )
        .attr("name", "displayMode")
        .attr(
            "value",
            d => d.value
        )
        .property(
            "checked",
            d => d.value === displayMode
        );


    modeLabels
        .append("span")
        .attr(
            "class",
            "control-chip"
        )
        .text(d => d.label);


    d3.selectAll(".display-mode")
        .on("change", function(event) {

            displayMode =
                event.currentTarget.value;

            update(true);
        });


    /* 町田市の結果表示 */

    root
        .append("div")
        .attr("id", "machidaSummary")
        .attr(
            "class",
            "mx-auto mt-5 max-w-xl rounded-2xl bg-orange-50 px-5 py-4 text-center ring-1 ring-orange-200"
        );
}


/* =========================
   町田市順位
========================= */

function getMachidaRank() {

    const sorted = [...data]
        .sort(
            (a, b) =>
                getDisplayValue(b) -
                getDisplayValue(a)
        );

    const index = sorted.findIndex(
        d =>
            d.municipality ===
            MACHIDA
    );

    return index + 1;
}


function renderMachidaSummary() {

    const machida = data.find(
        d =>
            d.municipality ===
            MACHIDA
    );

    if (!machida) return;

    const value =
        getDisplayValue(machida);

    const rank =
        getMachidaRank();

    const suffix =
        displayMode === "rate"
            ? "人 / 1,000人"
            : "人";

    d3.select("#machidaSummary")
        .html(`
            <p class="text-xs font-semibold tracking-wider text-orange-700">
                町田市
            </p>

            <p class="mt-1 text-lg font-bold text-slate-900">
                ${state.label}：
                <span class="text-orange-600">
                    ${formatDisplay(value)}${suffix}
                </span>
            </p>

            <p class="mt-1 text-sm font-semibold text-slate-600">
                東京都26市中
                <span class="text-orange-700">
                    ${rank}位
                </span>
            </p>
        `);
}


/* =========================
   サイズ・スケール
========================= */

function calculateLayout() {

    const element =
        document.querySelector(
            "#viewportContainer"
        );

    width = Math.max(
        Math.round(
            element
                .getBoundingClientRect()
                .width
        ),
        320
    );

    height = Math.max(
        Math.round(width / 2.15),
        360
    );

    svg
        .attr("width", width)
        .attr("height", height)
        .attr(
            "viewBox",
            `0 0 ${width} ${height}`
        );

    const values =
        data.map(getDisplayValue);

    if (state.type === "change") {

        const min =
            Math.min(
                0,
                d3.min(values)
            );

        const max =
            Math.max(
                0,
                d3.max(values)
            );

        const padding =
            Math.max(
                (max - min) * 0.08,
                0.1
            );

        xScale
            .domain([
                min - padding,
                max + padding
            ])
            .nice();

    } else {

        const max =
            d3.max(values);

        xScale
            .domain([
                0,
                max * 1.08
            ])
            .nice();
    }


    xScale.range([
        margin.left,
        width - margin.right
    ]);


    areaScale.domain(
        d3.extent(
            data,
            d => d.population
        )
    );


    const simulation =
        d3.forceSimulation(data)

            .force(
                "x",
                d3.forceX(
                    d =>
                        xScale(
                            getDisplayValue(d)
                        )
                )
                .strength(2)
            )

            .force(
                "y",
                d3.forceY(
                    centerY()
                )
                .strength(0.12)
            )

            .force(
                "collide",
                d3.forceCollide(
                    d =>
                        areaScale(
                            d.population
                        ) + 2
                )
            )

            .stop();


    simulation.tick(350);
}


/* =========================
   軸
========================= */

function renderAxis(animate) {

    const tickFormat = d => {

        if (displayMode === "rate") {

            return state.type === "change"
                ? formatSigned(d, true)
                : formatRate(d);
        }

        return state.type === "change"
            ? formatSigned(d)
            : formatValue(d);
    };


    const xAxis =
        d3.axisBottom(xScale)
            .ticks(
                width < 600
                    ? 5
                    : 9
            )
            .tickSizeOuter(0)
            .tickFormat(tickFormat);


    axis
        .attr(
            "transform",
            `translate(
                0,
                ${height - margin.bottom}
            )`
        )
        .interrupt();


    if (animate) {

        axis
            .transition()
            .duration(1000)
            .ease(d3.easeCubicInOut)
            .call(xAxis);

    } else {

        axis.call(xAxis);
    }


    axisUnit
        .attr(
            "transform",
            `translate(
                ${width - margin.right},
                ${height - margin.bottom - 20}
            )`
        )
        .attr(
            "text-anchor",
            "end"
        )
        .selectAll("text")
        .data([getUnit()])
        .join("text")
        .text(d => d);


    zeroLine.interrupt();


    if (state.type === "change") {

        zeroLine
            .style("opacity", 0.7);

        const target = animate
            ? zeroLine
                .transition()
                .duration(1000)
                .ease(d3.easeCubicInOut)
            : zeroLine;

        target
            .attr("x1", xScale(0))
            .attr("x2", xScale(0))
            .attr("y1", margin.top)
            .attr(
                "y2",
                height - margin.bottom
            );

    } else {

        zeroLine
            .style("opacity", 0);
    }
}


/* =========================
   凡例
========================= */

function renderLegend() {

    const items = [
        "町田市",
        "その他の市"
    ];

    legend
        .attr(
            "transform",
            `translate(
                ${width - margin.right - 130},
                ${margin.top}
            )`
        );


    legend
        .selectAll("circle")
        .data(items)
        .join("circle")
        .attr("cx", 0)
        .attr(
            "cy",
            (_, i) => i * 24
        )
        .attr("r", 6)
        .attr(
            "fill",
            d => colorScale(d)
        );


    legend
        .selectAll("text")
        .data(items)
        .join("text")
        .attr("x", 14)
        .attr(
            "y",
            (_, i) => i * 24 + 4
        )
        .text(d => d);
}


/* =========================
   円
========================= */

function renderBees(animate) {

    const bees = chart
        .selectAll(".bee")

        .data(
            data,
            d => d.municipality
        )

        .join(

            enter =>
                enter
                    .append("circle")
                    .attr(
                        "class",
                        "bee"
                    )
                    .attr(
                        "cx",
                        xScale(0)
                    )
                    .attr(
                        "cy",
                        centerY()
                    )
                    .attr("r", 0)
                    .style(
                        "fill-opacity",
                        0.9
                    ),

            update => update,

            exit =>
                exit
                    .transition()
                    .duration(500)
                    .attr("r", 0)
                    .remove()
        );


    bees
        .on(
            "mousemove",
            showTooltip
        )
        .on(
            "mouseout",
            () =>
                tooltip.style(
                    "opacity",
                    0
                )
        );


    bees.interrupt();


    let circles = bees;


    if (animate) {

        circles = bees
            .transition()
            .duration(1500)
            .ease(
                d3.easeCubicInOut
            );
    }


    circles
        .attr(
            "cx",
            d => d.x
        )
        .attr(
            "cy",
            d => d.y
        )
        .attr(
            "r",
            d =>
                areaScale(
                    d.population
                )
        )
        .style(
            "fill",
            d =>
                colorScale(
                    cityType(d)
                )
        )
        .style(
            "stroke",
            d =>
                d.municipality === MACHIDA
                    ? "#7c2d12"
                    : "#ffffff"
        )
        .style(
            "stroke-width",
            d =>
                d.municipality === MACHIDA
                    ? 3
                    : 1.5
        );


    renderMachidaLabel(animate);
}


/* =========================
   町田市ラベル
========================= */

function renderMachidaLabel(animate) {

    const machida =
        data.filter(
            d =>
                d.municipality ===
                MACHIDA
        );


    const label = chart
        .selectAll(
            ".machida-label"
        )
        .data(
            machida,
            d => d.municipality
        )
        .join("text")
        .attr(
            "class",
            "machida-label"
        )
        .attr(
            "text-anchor",
            "start"
        );


    label.interrupt();


    let target = label;


    if (animate) {

        target = label
            .transition()
            .duration(1500)
            .ease(
                d3.easeCubicInOut
            );
    }


    target
        .attr(
            "x",
            d =>
                d.x +
                areaScale(
                    d.population
                ) +
                7
        )
        .attr(
            "y",
            d => d.y + 4
        )
        .text(d => {

            const rank =
                getMachidaRank();

            return `町田市 ${formatDisplay(
                getDisplayValue(d)
            )}（${rank}位）`;
        });
}


/* =========================
   Tooltip
========================= */

function showTooltip(event, d) {

    const rect =
        document
            .querySelector(
                "#viewportContainer"
            )
            .getBoundingClientRect();


    const rate =
        getDisplayValue(d);

    const rank =
        [...data]
            .sort(
                (a, b) =>
                    getDisplayValue(b) -
                    getDisplayValue(a)
            )
            .findIndex(
                city =>
                    city.municipality ===
                    d.municipality
            ) + 1;


    const details =
        state.group === "social"

            ? `
                転入者数:
                <strong>
                    ${formatValue(d.moveIn)}人
                </strong>
                <br>

                転出者数:
                <strong>
                    ${formatValue(d.moveOut)}人
                </strong>
                <br>

                社会増減:
                <strong>
                    ${formatSigned(d.socialChange)}人
                </strong>
            `

            : `
                出生数:
                <strong>
                    ${formatValue(d.births)}人
                </strong>
                <br>

                死亡数:
                <strong>
                    ${formatValue(d.deaths)}人
                </strong>
                <br>

                自然増減:
                <strong>
                    ${formatSigned(d.naturalChange)}人
                </strong>
            `;


    const suffix =
        displayMode === "rate"
            ? "人 / 1,000人"
            : "人";


    tooltip
        .html(`
            市:
            <strong>
                ${d.municipality}
            </strong>
            <br>

            ${state.label}:
            <strong>
                ${formatDisplay(rate)}${suffix}
            </strong>
            <br>

            東京都26市中:
            <strong>
                ${rank}位
            </strong>
            <br>

            ${details}

            <br>

            2020年人口:
            <strong>
                ${formatValue(d.population)}人
            </strong>
        `)

        .style(
            "left",
            `${
                event.clientX -
                rect.left +
                25
            }px`
        )

        .style(
            "top",
            `${
                event.clientY -
                rect.top -
                12
            }px`
        )

        .style(
            "opacity",
            0.96
        );


    d3.select(
        event.currentTarget
    ).raise();
}


/* =========================
   更新
========================= */

function update(animate = true) {

    document
        .querySelector(
            "#chartTitle"
        )
        .textContent =
        state.title;


    const modeText =
        displayMode === "rate"
            ? "人口1,000人あたりで比較"
            : "人数で比較";


    document
        .querySelector(
            "#chartDescription"
        )
        .textContent =
        `${state.year}・${state.description}・${modeText}`;


    calculateLayout();

    renderAxis(animate);

    renderLegend();

    renderBees(animate);

    renderMachidaSummary();
}


/* =========================
   起動
========================= */

async function init() {

    try {

        await loadData();

        initControls();

        update(false);


        let timer;


        window.addEventListener(
            "resize",
            () => {

                clearTimeout(timer);

                timer =
                    setTimeout(
                        () =>
                            update(false),
                        150
                    );
            }
        );

    } catch (error) {

        console.error(error);

        container
            .append("p")
            .style(
                "padding",
                "30px"
            )
            .style(
                "color",
                "red"
            )
            .text(
                error.message
            );
    }
}


init();