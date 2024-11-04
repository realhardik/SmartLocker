const { ipcRenderer } = require("electron/renderer");
const BASE_URL = "http://localhost:3000"

class oRender {
    constructor(resp) {
        this.pdfContainer = F.G.id('pdf-container'),
        this.prevPageBtn = F.G.id('prev-page'),
        this.nextPageBtn = F.G.id('next-page'),
        this.pageNumSpan = F.G.id('page-num'),
        this.goToPageInput = F.G.id('go-to-page-input'),
        this.goToPageBtn = F.G.id('go-to-page-btn'),
        this.zoomOutBtn = F.G.id('zoom-out'),
        this.zoomInBtn = F.G.id('zoom-in');
        this.pageNum = 1;
        this.scale = 1.0;
        F.BM(this, ["renderPage", "loadPDF", "prevPage", "nextPage", "hop"])
        F.BM(this, ["zIn", "zOut", "init"])
        console.log("rendering")
        this.init(resp)
    }

    async renderPage(num) {
        const page = await this.pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: this.scale });
        const canvas = document.createElement('canvas');
        const canvasContext = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        this.pdfContainer.innerHTML = '';
        this.pdfContainer.appendChild(canvas);
        const renderContext = {
        canvasContext,
        viewport,
        };
        await page.render(renderContext);
    }

    async loadPDF(e) {
        try {
            var { from, to, token, fName } = e
            const response = await fetch(`${BASE_URL}/download/${fName}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ from, to })
            });

            let temp = response.headers.get("Content-Type");
            if (temp && temp.includes("application/json")) {
                temp = await response.json()
                if ((F.has('success', temp) && !temp.success) || !response.ok) {
                    var msg = temp.msg || "Some Error occured. Please try again later."
                    alert(msg)
                    ipcRenderer.invoke('close-render')
                    return
                }
            }
            

            var blob = await response.blob(),
                url = URL.createObjectURL(blob),
                loadingTask = pdfjsLib.getDocument(url),
                pdfDoc = await loadingTask.promise;

            this.pdfDoc = pdfDoc;
            console.log(pdfDoc)
            this.renderPage(this.pageNum);
            this.pageNumSpan.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
        } catch (error) {
            console.error('Error loading PDF:', error);
        }
    }

    init(d) {
        console.log(d)
        F.l('click', this.prevPageBtn, this.prevPage)
        F.l('click', this.nextPageBtn, this.nextPage)
        F.l('click', this.goToPageBtn, this.hop)
        F.l('click', this.zoomInBtn, this.zIn)
        F.l('click', this.zoomOutBtn, this.zOut)
        this.loadPDF(d)
    }

    prevPage() {
        if (this.pageNum > 1) {
            this.pageNum--;
            this.renderPage(this.pageNum);
            this.pageNumSpan.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
        }
    }

    nextPage() {
        if (this.pageNum < this.pdfDoc.numPages) {
            this.pageNum++;
            this.renderPage(this.pageNum);
            this.pageNumSpan.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
        }
    }

    hop() {
        const targetPage = parseInt(this.goToPageInput.value);
        if (targetPage >= 1 && targetPage <= this.pdfDoc.numPages) {
            this.pageNum = targetPage;
            this.renderPage(this.pageNum);
            this.pageNumSpan.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
        }
    }

    zIn() {
        if (this.scale < 3) {
            this.scale += 0.25;
            this.renderPage(this.pageNum);
        }
    }

    zOut() {
        if (this.scale > 0.25) {
            this.scale -= 0.25;
            this.renderPage(this.pageNum);
        }
    }
}

new class {
    constructor() {
        F.BM(this, ["init"])
        ipcRenderer.on('render-file', (e, data) => {
            console.log(data)
            console.log("render")
            this.init(data)
        })
    }

    init(d) {
        new oRender(d)
    }
}