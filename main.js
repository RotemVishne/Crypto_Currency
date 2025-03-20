/// <reference path="jquery-3.7.1.js"/>
"use strict";
$(()=>{
    // our two very important lists. notice that chosen is saved in local storage without a timer and will stay saved on your device even if you exit and re-enter.
    let coins = [];
    let chosen = JSON.parse(localStorage.getItem("chosen")) || [];
    // this is mostly a gateway for the code in css that carries the weight of showing the progress bar. It's called when needed.
    function showProgressBar(){
        const progressBar = `<div class="progress"></div>`;
        return progressBar;
    }
    // this is where everything really starts, once you open index.html.
    async function getCoins(){
        try{
            // first we try to see of we already have the coins in local storage.
            const cachedCoins = localStorage.getItem("coins");
            if(cachedCoins){
                // if we do - great!
                coins = JSON.parse(cachedCoins);
            }
            else{
                // if we don't - we call the API and save them for 2 minutes.
                $("#mainDisplay").html(showProgressBar());
                const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd";
                const response = await axios.get(url);
                coins = response.data;
                localStorage.setItem("coins", JSON.stringify(coins));
                setTimeout(() => localStorage.removeItem("coins"),1000*60*2);
            }
            displayCoins(coins);
        }
        catch(err){
            alert(err);
        }
    }
    getCoins(); // and this happens the moment we open the page.
    // now we have the coins, but we want to display them!
    function displayCoins(coins){
        let content = "";
        for(const coin of coins){
            content += `
                <div class="coinCard">
                    <input type="checkbox" class="toggle-checkbox" id="toggle-${coin.id}" data-id="${coin.id}" ${chosen.includes(coin.id)?"checked":""}>
                    <span>${coin.id}</span>
                    <br>
                    <img class="coinImg" src="${coin.image}" alt="${coin.name}">
                    <span>${coin.symbol}</span>
                    <br>
                    <span>${coin.name}</span>
                    <br>
                    <button class="more-info-btn" data-id="${coin.id}" data-bs-toggle="collapse" data-bs-target="#infoCollapse-${coin.id}">More Info</button>
                    <div id="infoCollapse-${coin.id}" class="collapse"></div>
                </div>
            `;
        }
        // above is the code for each coin card. below is the functions you can "summon" by pressing the "More Info" button or toggling the toggle.
        $("#mainDisplay").html(content);
        $(".toggle-checkbox").on("change",handleToggle);
        $(".more-info-btn").on("click",function(){
            const id = $(this).data("id");
            moreInfo(id);
        });
    }
    // when the "More Info" button is pressed - this function steps in to save the day.
    async function moreInfo(id){
        try{
            // first we check if we've gotten this info in our local storage.
            let info = JSON.parse(localStorage.getItem(`info-${id}`));
            if(!info){
                // if we don't - we call the API and save it for 2 minutes
                const infoCollapse = $(`#infoCollapse-${id}`);
                infoCollapse.html(showProgressBar());
                const url = "https://api.coingecko.com/api/v3/coins/";
                const response = await axios.get(url+id);
                info = response.data;
                localStorage.setItem(`info-${id}`,JSON.stringify(info));
                setTimeout(()=>localStorage.removeItem(`info-${id}`),1000*60*2);
            }
            // now we either had it already or went through the if and got it.
            displayInfo(info,id);
        }
        catch(err){
            alert(err);
        }
    }
    // now we've got the info and we want to display it on the card:
    function displayInfo(info,id){
        const infoCollapse = $(`#infoCollapse-${id}`);
        infoCollapse.html(`
            <div>
                <span>USD: ${info.market_data.current_price.usd}$</span>
                <br>
                <span>EUR: ${info.market_data.current_price.eur}€</span>
                <br>
                <span>ILS: ${info.market_data.current_price.ils}₪</span>
            </div>
        `);
    }
    // when a coin is toggled we go here:
    function handleToggle(event){
        const coinId = event.target.getAttribute("data-id");
        if(event.target.checked){
            if(chosen.length<5){
                chosen.push(coinId);
                // we save this information across pages, and also indefinitely.
                localStorage.setItem("chosen",JSON.stringify(chosen));
            }
            else{
                event.target.checked = false;
                showLimitModal();
            }
        }
        else{
            chosen = chosen.filter(coin => coin !== coinId);
            localStorage.setItem("chosen",JSON.stringify(chosen));
        }
    }
    // when we reach the limit of toggled on coins, this will pop up.
    function showLimitModal(){
        const modalContent = `
            <div class="modal fade" id="limitModal" tabindex="-1" aria-labelledby="limitModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="limitModalLabel">Limit Reached</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>You can only select up to 5 coins. Please deselect one to add another.</p>
                            <ul class="list-group">
                                ${chosen.map(coin => `
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        ${coin}
                                        <button class="btn btn-danger btn-sm" data-id="${coin}">Remove</button>
                                    </li>`).join("")}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML("beforeend", modalContent);
        const limitModal = new bootstrap.Modal($("#limitModal"));
        limitModal.show();
        $(".btn-danger").off("click").on("click",function(){
            const coinId = $(this).data("id");
            chosen = chosen.filter(coin => coin !== coinId);
            localStorage.setItem("chosen",JSON.stringify(chosen));
            $(`#toggle-${coinId}`).prop("checked",false);
            limitModal.hide();
            setTimeout(()=>{
                $("#limitModal").remove();
            },150);
        });
    }
    // this is the search-bar's dynamic searching function:
    $("#searchBox").on("input",()=>{
        const query = searchBox.value.toLowerCase();
        const filteredCoins = coins.filter(coin=>
            // you can search by id, symbol or name, for better results.
            coin.id.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query) || coin.name.toLowerCase().includes(query)
        );
        displayCoins(filteredCoins);
    });
    // from here everything is about the chart in live reports.
    const chartContainer = $("#chartContainer");
    const dataPointsMap = {};
    const colors = ["red","blue","yellow","cyan","magenta"];
    chosen.forEach(coin => {
        if (!dataPointsMap[coin]) {
            dataPointsMap[coin] = [];
        }
    });
    const coinColors = {};
    chosen.forEach((coin,index)=>{
        coinColors[coin] = colors[index % colors.length];
    });
    const options = {
        title:{
            text: "Cryptocurrency Prices in USD"
        },
        axisX:{
            title: "Time",
            valueFormatString: "DD MMM YYYY HH:mm:ss"
        },
        axisY:{
            title: "Price (USD)",
            prefix: "$"
        },
        toolTip:{
            shared: true,
            contentFormatter:function(e){
                let time = new Date(e.entries[0].dataPoint.x).toLocaleString("en-GB",{
                    hour12:false,
                    year:"numeric",
                    month:"short",
                    day:"2-digit",
                    hour:"2-digit",
                    minute:"2-digit",
                    second:"2-digit"
                });
                let content = `<strong>${time}</strong><br/>`;
                e.entries.forEach(entry => {
                    content += `<span style="color:${entry.dataSeries.lineColor}">●</span> ${entry.dataSeries.name}: $${entry.dataPoint.y}<br/>`;
                });
                return content;
            }
        },
        legend:{
            cursor: "pointer",
            verticalAlign: "top",
            fontSize: 20,
            fontColor: "black",
        },
        data:chosen.map(coin=>({
            type: "line",
            xValueType: "dateTime",
            showInLegend: true,
            name: coin,
            dataPoints: dataPointsMap[coin],
            lineColor: coinColors[coin],
            markerColor: coinColors[coin]
        }))
    };
    if(chosen.length>0){
        chartContainer.CanvasJSChart(options);
    }
    // above is all creating the initial data for the chart.
    // below is what data the chart shows us, that is updated via the setInterval below it.
    async function updateChart(){
        try{
            if(chosen.length === 0) return;
            const coinSymbols = chosen.map(id => coins.find(coin => coin.id === id)?.symbol.toUpperCase()).filter(Boolean);
            if(coinSymbols.length === 0) return;
            const url = `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${coinSymbols.join(",")}&tsyms=USD`;
            const response = await axios.get(url);
            const prices = response.data;
            const currentTime = new Date().getTime();
            chosen.forEach(coin=>{
                const symbol = coins.find(c => c.id === coin)?.symbol.toUpperCase();
                const price = prices[symbol]?.USD;
                if(price !== undefined){
                    dataPointsMap[coin].push({ x: currentTime, y: price });
                }
            });
            // for the best look, Iv'e chosen to separate the lines on the actual chart, and the visual aid in the legend above.
            options.data = chosen.flatMap(coin=>[
                {
                    type: "line",
                    xValueType: "dateTime",
                    showInLegend: false,
                    name: coin,
                    dataPoints: dataPointsMap[coin],
                    lineColor: coinColors[coin],
                    markerColor: coinColors[coin]
                },
                {
                    type: "scatter",
                    xValueType: "dateTime",
                    showInLegend: true,
                    name: coin,
                    dataPoints: [{x:new Date().getTime(),y: null}],
                    markerColor: coinColors[coin],
                    markerSize: 10,
                    showInLegend: true,
                    legendMarkerType: "circle"
                }
            ]);
            chartContainer.CanvasJSChart(options);
        }
        catch(err){
            alert(err);
        }
    }
    // if there are any coins, initialize the chart and update it every 2 seconds. if not, show the message
    if(chosen.length>0){
        chartContainer.CanvasJSChart(options);
        setInterval(updateChart,2*1000);
        updateChart();
    }
    else{
        chartContainer.CanvasJSChart.html("Toggle on coins in order to see the live reports.");
    }
});