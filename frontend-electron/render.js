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
        F.BM(this, ["zIn", "zOut"])
        this.init(resp)
    }

    async renderPage(num) {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: scale });
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

    async loadPDF(e, filename) {
        try {
            var { from, to, token } = e
            const response = await fetch(`/download/${filename}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ from, to })
            });
    
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }
    
            var blob = await response.blob(),
                url = URL.createObjectURL(blob),
                loadingTask = pdfjsLib.getDocument(url),
                pdfDoc = await loadingTask.promise;

            this.pdfDoc = pdfDoc;
            this.renderPage(this.pageNum);
            this.pageNumSpan.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
        } catch (error) {
            console.error('Error loading PDF:', error);
        }
    }

    init(d) {
        F.l('click', this.prevPageBtn, this.prevPage)
        F.l('click', this.nextPageBtn, this.nextPage)
        F.l('click', this.goToPageBtn, this.hop)
        F.l('click', this.zoomInBtn, this.zIn)
        F.l('click', this.zoomOutBtn, this.zOut)
        this.loadPDF(d.url)
    }

    prevPage() {
        if (this.pageNum > 1) {
            this.pageNum--;
            renderPage(this.pageNum);
            this.pageNumSpan.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
        }
    }

    nextPage() {
        if (this.pageNum < this.pdfDoc.numPages) {
            this.pageNum++;
            renderPage(this.pageNum);
            this.pageNumSpan.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
        }
    }

    hop() {
        const targetPage = parseInt(this.goToPageInput.value);
        if (targetPage >= 1 && targetPage <= this.pdfDoc.numPages) {
            this.pageNum = targetPage;
            renderPage(this.pageNum);
            this.pageNumSpan.textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
        }
    }

    zIn() {
        if (this.scale < 3) {
            this.scale += 0.25;
            renderPage(this.pageNum);
        }
    }

    zOut() {
        if (this.scale > 0.25) {
            this.scale -= 0.25;
            renderPage(this.pageNum);
        }
    }
}