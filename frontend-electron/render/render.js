const { ipcRenderer } = require("electron/renderer");
const BASE_URL = "http://localhost:3000"

F.getToken = async () => {
    var t = await ipcRenderer.invoke('isAuthorized')
    console.log("got token", t)
    return t
}

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
            console.log(e)
            var { fId } = e,
            watermark_opt = e.watermark_options,
            tokenReq = await F.getToken()
            const response = await fetch(`${BASE_URL}/download/${fId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenReq.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "selected_algos": e.layers,
                    "all_passphrases": e.passwords,
                    "filename": "encrypted",
                    "watermark_text": e.watermark ? watermark_opt.custom : "",
                    "watermark_color": e.watermark ? watermark_opt.color : "",
                    "watermark_size": e.watermark ? watermark_opt.size : 40,
                    "watermark_opacity": e.watermark ? watermark_opt.size : 0,
                    "watermark_row": e.watermark ? watermark_opt.size : 3,
                    "watermark_column": e.watermark ? watermark_opt.size : 3
                })
            });

            if (response.ok) {
                const contentDisposition = response.headers.get('content-disposition');
                const filename = contentDisposition ? contentDisposition.split('filename=')[1].replace(/['"]/g, '') : 'downloaded-file.pdf';
                
                const arrayBuffer = await response.arrayBuffer();
                
                const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                const fileUrl = URL.createObjectURL(blob);
                var loadingTask = pdfjsLib.getDocument(fileUrl),
                pdfDoc = await loadingTask.promise;

            this.pdfDoc = pdfDoc;
            console.log(pdfDoc)
            this.renderPage(this.pageNum);
            this.pageNumSpan.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;

              } else {
                var msg = temp.msg || "Some Error occured. Please try again later."
                    alert(msg)
                    ipcRenderer.invoke('close-render')
                    return
              }
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