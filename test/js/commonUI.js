(function () {
    var btn = document.createElement('button');
    btn.innerHTML = 'DISPOSE';
    btn.style.cssText = `
        position:absolute;
        left: 10px;
        top: 10px;
        background: rgb(42, 64, 173);
        color: #fff;
        border: none;
        padding: 5px 10px;
        z-index: 1000000;
        cursor: pointer;
    `;

    btn.onclick = function () {
        (typeof myChart !== 'undefined') && myChart.dispose();
        (typeof chart !== 'undefined') && chart.dispose();
    }

    document.body.appendChild(btn);
})();