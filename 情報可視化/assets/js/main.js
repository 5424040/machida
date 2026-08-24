// main.js

/* -------------------------
   基本設定
------------------------- */

const MACHIDA = "町田市";

const viewport = {
    width: 0,
    height: 0,
    aspect: 2.15
};

const margin = {
    top: 70,
    right: 70,
    bottom: 65,
    left: 70
};

const legendOffset = {
    x: -130,
    y: 0
};


/* -------------------------
   コンテナ
------------------------- */

let viewportContainer;
let chartContainer;
let axisContainer;
let xAxisGroup;
let axisUnit;
let tooltipContainer;
let legendContainer;
let zeroLine;


/* -------------------------
   データ
------------------------- */

let dataAll = [];


/* -------------------------
   選択できる指標
------------------------- */

const dimensions = [

    {
        label: "社会増減",
        value: "socialChange",
        unit: "人",
        title: "社会増減（転入者数 − 転出者数）",
        description: "2024年・0より右が転入超過、左が転出超過"
    },

    {
        label: "自然増減",
        value: "naturalChange",
        unit: "人",
        title: "自然増減（出生数 − 死亡数）",
        description: "2023年・0より右が自然増、左が自然減"
    }

];


const state = {

    selectedDimension: dimensions[0].value,

    selectedUnit: dimensions[0].unit,

    selectedLabel: dimensions[0].label,

    selectedTitle: dimensions[0].title,

    selectedDescription: dimensions[0].description

};


/* -------------------------
   スケール
------------------------- */

const xScale = d3.scaleLinear();

const areaScale = d3.scaleSqrt();

const colorScale = d3.scaleOrdinal()
    .domain(["町田市", "その他の市"])
    .range([
        "#f97316",
        "#38bdf8"
    ]);

const beeRadiusRange = [7, 23];


/* -------------------------
   数値表示
------------------------- */

function formatValue(value) {

    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
        return numericValue.toLocaleString("ja-JP");
    }

    return value;

}


/* -------------------------
   + / - 表示
------------------------- */

function formatSignedValue(value) {

    const number = Number(value);

    if (number > 0) {
        return `+${formatValue(number)}`;
    }

    if (number < 0) {
        return `−${formatValue(Math.abs(number))}`;
    }

    return "0";

}


/* -------------------------
   円のカテゴリ
------------------------- */

function getCityType(d) {

    if (d.municipality === MACHIDA) {
        return "町田市";
    }

    return "その他の市";

}


/* -------------------------
   Beeswarm中央Y
------------------------- */

function getBeeY() {

    return (
        margin.top +
        ((viewport.height - margin.top - margin.bottom) / 2)
    );

}


/* -------------------------
   画面サイズ取得
------------------------- */

function getWindowSize() {

    const container =
        document.querySelector("#viewportContainer");

    const containerWidth =
        container.getBoundingClientRect().width;

    viewport.width =
        Math.max(
            Math.round(containerWidth),
            320
        );

    viewport.height =
        Math.max(
            Math.round(
                viewport.width / viewport.aspect
            ),
            360
        );

}


/* -------------------------
   SVG初期化
------------------------- */

function initViewport() {

    viewportContainer =
        d3.select("#viewportContainer")
            .append("svg")
            .attr("id", "svgArea")
            .attr("width", viewport.width)
            .attr("height", viewport.height)
            .attr(
                "viewBox",
                `0 0 ${viewport.width} ${viewport.height}`
            )
            .attr(
                "preserveAspectRatio",
                "xMidYMid"
            );


    zeroLine =
        viewportContainer
            .append("line")
            .attr("class", "zero-line");


    chartContainer =
        viewportContainer
            .append("g")
            .attr(
                "id",
                "chartContainer"
            );


    axisContainer =
        viewportContainer
            .append("g")
            .attr(
                "id",
                "axisContainer"
            )
            .attr(
                "transform",
                `translate(0,${viewport.height - margin.bottom})`
            );


    xAxisGroup =
        axisContainer
            .append("g")
            .attr(
                "id",
                "xAxis"
            )
            .attr(
                "class",
                "axis"
            );


    axisUnit =
        axisContainer
            .append("g")
            .attr(
                "id",
                "axisUnit"
            )
            .attr(
                "class",
                "axis-unit"
            )
            .attr(
                "transform",
                `translate(${viewport.width - margin.right},-20)`
            )
            .attr(
                "text-anchor",
                "end"
            );


    tooltipContainer =
        d3.select("#viewportContainer")
            .append("div")
            .attr(
                "id",
                "tooltipContainer"
            )
            .style(
                "opacity",
                0
            );


    legendContainer =
        viewportContainer
            .append("g")
            .attr(
                "id",
                "legendContainer"
            )
            .attr(
                "class",
                "legend"
            )
            .attr(
                "transform",
                `translate(
                    ${viewport.width - margin.right + legendOffset.x},
                    ${margin.top + legendOffset.y}
                )`
            );

}


/* -------------------------
   データ読み込み
------------------------- */

async function loadData() {

    const response = await fetch(
        "assets/data/SSDSE-A-2026.csv"
    );

    if (!response.ok) {
        throw new Error("SSDSE-A-2026.csvを読み込めませんでした");
    }


    // SSDSE-A-2026.csvはShift-JISなので、
    // そのままd3.csv()ではなくTextDecoderを使う
    const buffer = await response.arrayBuffer();

    const text = new TextDecoder(
        "shift_jis"
    ).decode(buffer);


    const rows = d3.csvParseRows(text);


    /*
        0行目：変数コード
        1行目：年度
        2行目：日本語の項目名
        3行目以降：実データ
    */

    const header = rows[0];


    function getColumnIndex(code) {

        return header.indexOf(code);

    }


    const populationIndex =
        getColumnIndex("A1101");

    const birthsIndex =
        getColumnIndex("A4101");

    const deathsIndex =
        getColumnIndex("A4200");

    const moveInIndex =
        getColumnIndex("A5101");

    const moveOutIndex =
        getColumnIndex("A5102");


    dataAll = rows
        .slice(3)

        // 東京都だけ
        .filter(function(row) {

            return (
                row[1] === "東京都" &&
                row[2].endsWith("市")
            );

        })

        // 必要な項目だけ扱いやすい形にする
        .map(function(row) {

            const population =
                Number(
                    row[populationIndex]
                );

            const births =
                Number(
                    row[birthsIndex]
                );

            const deaths =
                Number(
                    row[deathsIndex]
                );

            const moveIn =
                Number(
                    row[moveInIndex]
                );

            const moveOut =
                Number(
                    row[moveOutIndex]
                );


            return {

                code: row[0],

                prefecture: row[1],

                municipality: row[2],

                population: population,

                births: births,

                deaths: deaths,

                moveIn: moveIn,

                moveOut: moveOut,


                // 社会増減
                socialChange:
                    moveIn - moveOut,


                // 自然増減
                naturalChange:
                    births - deaths

            };

        });


    console.log(
        "読み込んだデータ",
        dataAll
    );


    console.log(
        "町田市",
        dataAll.find(function(d) {
            return d.municipality === "町田市";
        })
    );

}


/* -------------------------
   選択UI
------------------------- */

function initControls() {

    const controls =
        d3.select("#variableSelector")
            .append("form")
            .attr(
                "class",
                "flex flex-wrap items-center justify-center gap-3"
            )
            .selectAll("label")
            .data(
                dimensions,
                function(d) {
                    return d.value;
                }
            )
            .join("label")
            .attr(
                "class",
                "control-label"
            );


    controls
        .append("input")
        .attr(
            "type",
            "radio"
        )
        .attr(
            "class",
            "control-radio measure"
        )
        .attr(
            "name",
            "measure"
        )
        .attr(
            "id",
            function(d, i) {
                return `measure_${i}`;
            }
        )
        .attr(
            "value",
            function(d) {
                return d.value;
            }
        )
        .property(
            "checked",
            function(d) {

                return (
                    d.value ===
                    state.selectedDimension
                );

            }
        );


    controls
        .append("span")
        .attr(
            "class",
            "control-chip"
        )
        .text(
            function(d) {
                return d.label;
            }
        );


    d3.selectAll(".measure")
        .on(
            "change",
            async function(event) {

                state.selectedDimension =
                    event.currentTarget.value;


                const selectedDimension =
                    dimensions.find(
                        function(dimension) {

                            return (
                                dimension.value ===
                                state.selectedDimension
                            );

                        }
                    );


                state.selectedUnit =
                    selectedDimension.unit;

                state.selectedLabel =
                    selectedDimension.label;

                state.selectedTitle =
                    selectedDimension.title;

                state.selectedDescription =
                    selectedDimension.description;


                document
                    .querySelector("#chartTitle")
                    .textContent =
                    state.selectedTitle;


                document
                    .querySelector("#chartDescription")
                    .textContent =
                    state.selectedDescription;


                await runSteps([

                    setScales,

                    parseData,

                    renderAxes,

                    renderLegend,

                    renderBees,

                    bindInteractions

                ]);

            }
        );

}


/* -------------------------
   スケール設定
------------------------- */

function setScales() {

    const values =
        dataAll.map(
            function(d) {

                return Number(
                    d[state.selectedDimension]
                );

            }
        );


    const minValue =
        Math.min(
            0,
            d3.min(values)
        );


    const maxValue =
        Math.max(
            0,
            d3.max(values)
        );


    const difference =
        maxValue - minValue;


    const padding =
        difference === 0
            ? 1
            : difference * 0.08;


    xScale
        .domain([
            minValue - padding,
            maxValue + padding
        ])
        .nice()
        .range([
            margin.left,
            viewport.width - margin.right
        ]);


    areaScale
        .domain(
            d3.extent(
                dataAll,
                function(d) {
                    return d.population;
                }
            )
        )
        .range(
            beeRadiusRange
        );

}


/* -------------------------
   Force Simulation
------------------------- */

function parseData() {

    const simulation =
        d3.forceSimulation(dataAll)

            .force(
                "x",
                d3.forceX(
                    function(d) {

                        return xScale(
                            Number(
                                d[state.selectedDimension]
                            )
                        );

                    }
                )
                .strength(2)
            )

            .force(
                "y",
                d3.forceY(
                    getBeeY()
                )
                .strength(0.12)
            )

            .force(
                "collide",
                d3.forceCollide()
                    .radius(
                        function(d) {

                            return (
                                areaScale(
                                    d.population
                                ) + 2
                            );

                        }
                    )
            )

            .stop();


    simulation.tick(350);

}


/* -------------------------
   軸
------------------------- */

function renderAxes() {

    const xAxis =
        d3.axisBottom(xScale)

            .ticks(
                viewport.width < 600
                    ? 5
                    : 9
            )

            .tickSizeOuter(0)

            .tickFormat(
                function(d) {
                    return formatSignedValue(d);
                }
            );


    axisContainer
        .attr(
            "transform",
            `translate(0,${viewport.height - margin.bottom})`
        );


    xAxisGroup

        .transition()

        .duration(1000)

        .call(xAxis);


    axisUnit

        .attr(
            "transform",
            `translate(${viewport.width - margin.right},-20)`
        )

        .selectAll("text")

        .data([
            state.selectedUnit
        ])

        .join("text")

        .attr(
            "class",
            "units"
        )

        .text(
            function(d) {
                return d;
            }
        );


    zeroLine

        .transition()

        .duration(1000)

        .attr(
            "x1",
            xScale(0)
        )

        .attr(
            "x2",
            xScale(0)
        )

        .attr(
            "y1",
            margin.top
        )

        .attr(
            "y2",
            viewport.height -
            margin.bottom
        );

}


/* -------------------------
   凡例
------------------------- */

function renderLegend() {

    legendContainer

        .attr(
            "transform",
            `translate(
                ${viewport.width - margin.right + legendOffset.x},
                ${margin.top + legendOffset.y}
            )`
        );


    const legend =
        d3.legendColor()

            .shape(
                "circle"
            )

            .shapeRadius(6)

            .shapePadding(8)

            .labelOffset(8)

            .scale(
                colorScale
            );


    legendContainer
        .call(
            legend
        );

}


/* -------------------------
   円描画
------------------------- */

function renderBees() {

    const bees =
        chartContainer
            .selectAll(".bee")

            .data(
                dataAll,
                function(d) {
                    return d.municipality;
                }
            )

            .join(

                function(enter) {

                    return enter
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
                            getBeeY()
                        )

                        .attr(
                            "r",
                            0
                        )

                        .style(
                            "fill",
                            "#ffffff"
                        )

                        .style(
                            "stroke",
                            "#ffffff"
                        )

                        .style(
                            "stroke-width",
                            1.5
                        )

                        .style(
                            "fill-opacity",
                            0.9
                        );

                },


                function(update) {

                    return update;

                },


                function(exit) {

                    exit

                        .transition()

                        .duration(500)

                        .attr(
                            "r",
                            0
                        )

                        .remove();


                    return exit;

                }

            );


    bees

        .transition()

        .duration(1500)

        .attr(
            "cx",
            function(d) {
                return d.x;
            }
        )

        .attr(
            "cy",
            function(d) {
                return d.y;
            }
        )

        .attr(
            "r",
            function(d) {

                return areaScale(
                    d.population
                );

            }
        )

        .style(
            "fill",
            function(d) {

                return colorScale(
                    getCityType(d)
                );

            }
        )

        .style(
            "stroke",
            function(d) {

                if (
                    d.municipality ===
                    MACHIDA
                ) {

                    return "#7c2d12";

                }

                return "#ffffff";

            }
        )

        .style(
            "stroke-width",
            function(d) {

                if (
                    d.municipality ===
                    MACHIDA
                ) {

                    return 3;

                }

                return 1.5;

            }
        );


    const machidaData =
        dataAll.filter(
            function(d) {

                return (
                    d.municipality ===
                    MACHIDA
                );

            }
        );


    chartContainer
        .selectAll(".machida-label")

        .data(
            machidaData,
            function(d) {
                return d.municipality;
            }
        )

        .join("text")

        .attr(
            "class",
            "machida-label"
        )

        .attr(
            "text-anchor",
            "start"
        )

        .text(
            "町田市"
        )

        .transition()

        .duration(1500)

        .attr(
            "x",
            function(d) {

                return (
                    d.x +
                    areaScale(
                        d.population
                    ) +
                    7
                );

            }
        )

        .attr(
            "y",
            function(d) {

                return d.y + 4;

            }
        );

}


/* -------------------------
   Tooltip
------------------------- */

function bindInteractions() {

    chartContainer
        .selectAll(".bee")

        .on(
            "mousemove",
            function(event) {

                const d =
                    d3.select(this)
                        .datum();


                const container =
                    document.querySelector(
                        "#viewportContainer"
                    );


                const containerRect =
                    container
                        .getBoundingClientRect();


                let details;


                if (
                    state.selectedDimension ===
                    "socialChange"
                ) {

                    details = `
                        転入者数:
                        <strong>
                            ${formatValue(d.moveIn)}人
                        </strong>
                        <br>

                        転出者数:
                        <strong>
                            ${formatValue(d.moveOut)}人
                        </strong>
                    `;

                } else {

                    details = `
                        出生数:
                        <strong>
                            ${formatValue(d.births)}人
                        </strong>
                        <br>

                        死亡数:
                        <strong>
                            ${formatValue(d.deaths)}人
                        </strong>
                    `;

                }


                tooltipContainer

                    .html(
                        `
                        市:
                        <strong>
                            ${d.municipality}
                        </strong>
                        <br>

                        ${state.selectedLabel}:
                        <strong>
                            ${formatSignedValue(
                                d[state.selectedDimension]
                            )}人
                        </strong>
                        <br>

                        ${details}

                        <br>

                        2020年人口:
                        <strong>
                            ${formatValue(
                                d.population
                            )}人
                        </strong>
                        `
                    )

                    .style(
                        "top",
                        `${
                            event.clientY -
                            containerRect.top -
                            12
                        }px`
                    )

                    .style(
                        "left",
                        `${
                            event.clientX -
                            containerRect.left +
                            25
                        }px`
                    )

                    .style(
                        "opacity",
                        0.96
                    );


                d3.select(this)
                    .raise();

            }
        )


        .on(
            "mouseout",
            function() {

                tooltipContainer
                    .style(
                        "opacity",
                        0
                    );

            }
        );

}


/* -------------------------
   リサイズ
------------------------- */

async function updateLayout() {

    getWindowSize();


    viewportContainer

        .attr(
            "width",
            viewport.width
        )

        .attr(
            "height",
            viewport.height
        )

        .attr(
            "viewBox",
            `0 0 ${viewport.width} ${viewport.height}`
        );


    await runSteps([

        setScales,

        parseData,

        renderAxes,

        renderLegend,

        renderBees,

        bindInteractions

    ]);

}


/* -------------------------
   実行
------------------------- */

async function initApp() {

    await runSteps([

        getWindowSize,

        initViewport,

        loadData,

        initControls,

        setScales,

        parseData,

        renderAxes,

        renderLegend,

        renderBees,

        bindInteractions

    ]);


    let resizeTimer;


    window.addEventListener(
        "resize",
        function() {

            clearTimeout(
                resizeTimer
            );


            resizeTimer =
                setTimeout(
                    updateLayout,
                    150
                );

        }
    );

}


/* -------------------------
   順番に関数実行
------------------------- */

async function runSteps(steps) {

    for (
        const step of steps
    ) {

        await step();

    }

}


initApp()
    .catch(
        function(error) {

            console.error(
                error
            );

        }
    );