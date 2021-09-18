const {isFinish, getWinner} = require("./libs");


function IA(morpion,currentPlayer) {
    this.profondeurLimit = 5;

    this.startIa = function () {
        return this.genTreeMinMax(copyTab(morpion), 0, currentPlayer);
    };

    this.genTreeMinMax = async function (morpionb, p = 0, player) {
        let toKeep = null;
        for (let l = 0; l < morpionb.length; l++) {
            for (let c = 0; c < morpionb[l].length; c++) {
                if (morpionb[l][c] === 0) {
                    let morpionc = copyTab(morpionb);
                    morpionc[l][c] = player;
                    let winner = getWinner(morpionc);

                    let score;
                    if (winner === currentPlayer) {
                        score = 1000;
                    } else if (winner !== null && winner !== currentPlayer) {
                        score = -1000;
                    } else if (isFinish(morpionc) || p >= this.profondeurLimit) {
                        score = 0;
                    } else {
                        score = await this.genTreeMinMax(morpionc, p + 1, player === 1 ? 2 : 1)
                            .then(({score}) => score);
                    }
                    if ((toKeep == null) ||
                        (p % 2 === 0 && score > toKeep.score) ||
                        (p % 2 === 1 && score < toKeep.score) ||
                        (score === toKeep.score && Math.random() < 1/2)) {
                        toKeep = {score, l, c};
                    }
                }
            }
        }
        return toKeep != null ? toKeep : {score: 0}
    };
}

function copyTab(tab) {
    let tab2 = [];
    for (let l=0;l<tab.length;l++) {
        tab2.push([]);
        for (let c=0;c<tab[l].length;c++) {
            tab2[l].push(tab[l][c]);
        }
    }
    return tab2;
}

module.exports = IA
