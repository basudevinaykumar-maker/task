const upload = document.getElementById("upload");
const oilPercentText = document.getElementById("oilPercent");

const originalCanvas = document.getElementById("originalCanvas");
const oilCanvas = document.getElementById("oilCanvas");

const originalCtx = originalCanvas.getContext("2d");
const oilCtx = oilCanvas.getContext("2d");

upload.addEventListener("change", function(event) {

    const file = event.target.files[0];
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = function() {

        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        oilCanvas.width = img.width;
        oilCanvas.height = img.height;

        originalCtx.drawImage(img, 0, 0);
        detectOilAdvanced();
    };
});


function rgbToHsv(r, g, b) {

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;

    if (diff !== 0) {
        if (max === r) h = ((g - b) / diff) % 6;
        else if (max === g) h = (b - r) / diff + 2;
        else h = (r - g) / diff + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : diff / max;
    const v = max;

    return [h, s, v];
}


function detectOilAdvanced() {

    const width = originalCanvas.width;
    const height = originalCanvas.height;

    const imageData = originalCtx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    let oilCount = 0;
    let waterArea = 0;

    for (let i = 0; i < pixels.length; i += 4) {

        const r = pixels[i];
        const g = pixels[i+1];
        const b = pixels[i+2];

        const brightness = (r + g + b) / 3;

        // Only consider pixels that look like water (not strong green/brown land)
        const looksLikeWater =
            (b > r * 0.8) &&     // some blue presence
            (g < r + 40);        // avoid strong green land

        if (!looksLikeWater) continue;

        waterArea++;

        // DARK WATER detection
        if (brightness < 80) {

            // highlight clean strong red
            pixels[i] = 255;
            pixels[i+1] = 0;
            pixels[i+2] = 0;

            oilCount++;
        }
    }

    const percent = waterArea > 0
        ? ((oilCount / waterArea) * 100).toFixed(2)
        : 0;

    oilPercentText.innerText = percent + "%";

    oilCtx.putImageData(imageData, 0, 0);
    drawOilRegions();

}
function drawOilRegions() {

    const width = oilCanvas.width;
    const height = oilCanvas.height;

    const imageData = oilCtx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    const visited = new Array(width * height).fill(false);

    let totalRegions = 0;
    let heavyCount = 0;
    let mediumCount = 0;
    let lightCount = 0;

    function getIndex(x, y) {
        return (y * width + x) * 4;
    }

    function isRedPixel(i) {
        return pixels[i] === 255 &&
               pixels[i + 1] === 0 &&
               pixels[i + 2] === 0;
    }

    function bfs(startX, startY) {

        const queue = [[startX, startY]];
        visited[startY * width + startX] = true;

        let minX = startX, maxX = startX;
        let minY = startY, maxY = startY;
        let count = 0;

        while (queue.length > 0) {

            const [x, y] = queue.shift();
            const i = getIndex(x, y);

            if (!isRedPixel(i)) continue;

            count++;

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            const directions = [
                [1, 0], [-1, 0],
                [0, 1], [0, -1]
            ];

            for (let [dx, dy] of directions) {

                const nx = x + dx;
                const ny = y + dy;

                if (
                    nx >= 0 && nx < width &&
                    ny >= 0 && ny < height &&
                    !visited[ny * width + nx]
                ) {
                    visited[ny * width + nx] = true;
                    queue.push([nx, ny]);
                }
            }
        }

        return { minX, maxX, minY, maxY, count };
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {

            if (visited[y * width + x]) continue;

            const i = getIndex(x, y);

            if (isRedPixel(i)) {

                const region = bfs(x, y);

                if (region.count < 50) continue;

                totalRegions++;

                const boxWidth = region.maxX - region.minX;
                const boxHeight = region.maxY - region.minY;

                oilCtx.strokeStyle = "white";
                oilCtx.lineWidth = 2;
                oilCtx.strokeRect(
                    region.minX,
                    region.minY,
                    boxWidth,
                    boxHeight
                );

                let label = "";
                let color = "";

                if (region.count > 5000) {
                    label = "Heavy";
                    color = "red";
                    heavyCount++;
                }
                else if (region.count > 1500) {
                    label = "Medium";
                    color = "orange";
                    mediumCount++;
                }
                else {
                    label = "Light";
                    color = "yellow";
                    lightCount++;
                }

                oilCtx.fillStyle = color;
                oilCtx.font = "bold 16px Arial";
                oilCtx.fillText(label, region.minX, region.minY - 5);
            }
        }
    }

    // 🔥 UPDATE ANALYTICS PANEL
    document.getElementById("regionCount").innerText = totalRegions;
    document.getElementById("heavyCount").innerText = heavyCount;
    document.getElementById("mediumCount").innerText = mediumCount;
    document.getElementById("lightCount").innerText = lightCount;
}



