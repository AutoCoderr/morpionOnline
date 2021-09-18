const HEIGHT = 3,
    WIDTH = 3;


function isFinish(morpion) {
    for (let l=0;l<morpion.length;l++) {
        for (let c=0;c<morpion[l].length;c++) {
            if (morpion[l][c] == 0) {
                return false;
            }
        }
    }
    return true;
}

function getWinner(morpion) {
    for (let l=0;l<morpion.length;l++) {
        for (let c=0;c<morpion[l].length;c++) {
            if (morpion[l][c] !== 0 && (l === 0 || l === morpion.length-1 || c === 0 || c === morpion[l].length-1)) {
                let playerType = morpion[l][c]
                let arrounds = getArround(l,c, morpion);
                for (let i=0;i<arrounds.length;i++) {
                    let lb = l;
                    let cb = c;
                    let j = 0;
                    while(j <= WIDTH && lb >= 0 && lb < morpion.length && cb >= 0 && cb < morpion[0].length && morpion[lb][cb] === playerType) {
                        lb += arrounds[i].l;
                        cb += arrounds[i].c;
                        j += 1;
                    }
                    if (j === WIDTH) {
                        return playerType;
                    }
                }
            }
        }
    }
    return null;
}

function getArround(l,c, morpion) {
    return [{l: -1, c: -1}, {l: -1, c: 0}, {l: -1, c: 1},
        {l: 0, c: -1}, {l: 0, c: 1},
        {l: 1, c: -1}, {l: 1, c: 0}, {l: 1, c: 1}]
        .filter(({l: lb,c: cb}) => morpion[l+lb] && morpion[l+lb][c+cb]);

}

module.exports = {isFinish, getWinner, HEIGHT, WIDTH}
