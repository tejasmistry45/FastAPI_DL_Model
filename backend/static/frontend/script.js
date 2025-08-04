class CarClassifierApp {
    constructor() {
        this.apiBaseUrl = '';
        this.selectedFile = null;
        this.initializeElements();
        this.setupEventListeners();
        this.checkApiHealth();
    }

    initializeElements() {
        // Safe element initialization with null checks
        this.uploadZone = this.safeGetElement('uploadZone');
        this.previewZone = this.safeGetElement('previewZone');
        this.processingZone = this.safeGetElement('processingZone');
        this.resultsZone = this.safeGetElement('resultsZone');
        this.errorZone = this.safeGetElement('errorZone');

        // Elements
        this.uploadArea = this.safeGetElement('uploadArea');
        this.fileInput = this.safeGetElement('fileInput');
        this.imagePreview = this.safeGetElement('imagePreview');
        this.classifyBtn = this.safeGetElement('classifyBtn');
        this.resultImage = this.safeGetElement('resultImage');
        this.predictionValue = this.safeGetElement('predictionValue');
        this.confidenceValue = this.safeGetElement('confidenceValue');
        this.probabilitiesList = this.safeGetElement('probabilitiesList');
        this.probabilitiesBox = this.safeGetElement('probabilitiesBox');
        this.newImageBtn = this.safeGetElement('newImageBtn');
        this.retryBtn = this.safeGetElement('retryBtn');
        this.errorMessage = this.safeGetElement('errorMessage');
    }

    // Safe element getter with null check
    safeGetElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found in DOM`);
        }
        return element;
    }

    // Safe display setter
    safeSetDisplay(element, value) {
        if (element) {
            element.style.display = value;
        } else {
            console.warn(`Cannot set display - element is null`);
        }
    }

    setupEventListeners() {
        // File input - IMPORTANT: Clear value on click to prevent double dialog
        if (this.fileInput) {
            this.fileInput.addEventListener('click', (event) => {
                event.target.value = null; // This prevents double dialog issue
            });
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Upload area click - only if elements exist
        if (this.uploadArea && this.fileInput) {
            this.uploadArea.addEventListener('click', () => {
                this.fileInput.click();
            });
        }

        // Drag and drop events - only if uploadArea exists
        if (this.uploadArea) {
            this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        }

        // Button events - only if buttons exist
        if (this.classifyBtn) {
            this.classifyBtn.addEventListener('click', () => this.classifyImage());
        }

        if (this.newImageBtn) {
            this.newImageBtn.addEventListener('click', () => this.resetApp());
        }

        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => this.resetApp());
        }
    }

    async checkApiHealth() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            console.log('API Health:', data);
        } catch (error) {
            console.error('API Health Check Failed:', error);
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        if (this.uploadArea) {
            this.uploadArea.classList.add('dragover');
        }
    }

    handleDragLeave(e) {
        e.preventDefault();
        if (this.uploadArea) {
            this.uploadArea.classList.remove('dragover');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        if (this.uploadArea) {
            this.uploadArea.classList.remove('dragover');
        }
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFile(files[0]);
        }
    }

    handleFileSelect(e) {
        console.log('File select event triggered');
        const file = e.target.files[0];
        if (file) {
            console.log('File selected:', file.name);
            this.handleFile(file);
        }
    }

    handleFile(file) {
        console.log('Processing file:', file.name, file.type, file.size);

        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showError('File too large. Please select an image under 10MB.');
            return;
        }

        this.selectedFile = file;
        this.showPreview(file);
    }

    showPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('Image loaded, showing preview');
            if (this.imagePreview) {
                this.imagePreview.src = e.target.result;
            }
            this.showZone('preview');
        };
        reader.onerror = () => {
            console.error('Error reading file');
            this.showError('Error reading the selected file');
        };
        reader.readAsDataURL(file);
    }

    async classifyImage() {
        if (!this.selectedFile) {
            this.showError('Please select an image first.');
            return;
        }

        this.showZone('processing');

        try {
            const formData = new FormData();
            formData.append('file', this.selectedFile);

            const response = await fetch('/predict', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.displayResults(data.prediction);
            } else {
                throw new Error(data.message || 'Classification failed');
            }

        } catch (error) {
            console.error('Classification error:', error);
            this.showError(`Classification failed: ${error.message}`);
        }
    }

    displayResults(prediction) {
        // Set result image safely
        if (this.resultImage && this.imagePreview) {
            this.resultImage.src = this.imagePreview.src;
        }

        // Set prediction safely
        if (this.predictionValue) {
            this.predictionValue.textContent = prediction.predicted_class.replace(/_/g, ' ');
        }

        if (this.confidenceValue) {
            this.confidenceValue.textContent = `${(prediction.confidence * 100).toFixed(1)}% confidence`;
        }

        // IMPROVED: More robust "Not a Car" detection
        const isNotCar =
            prediction.predicted_class === "Not a Car" ||
            prediction.predicted_class.toLowerCase().includes("not") ||
            prediction.predicted_class.toLowerCase().includes("ood") ||
            (prediction.ood_probability && prediction.ood_probability < 0.5) ||
            !prediction.class_probabilities; // If no class probabilities, it's not a car

        console.log('Is Not Car:', isNotCar, 'Predicted Class:', prediction.predicted_class);

        if (isNotCar) {
            // Hide probabilities section completely for non-car predictions
            this.safeSetDisplay(this.probabilitiesBox, 'none');
            console.log('Hiding probabilities section for non-car prediction');
        } else {
            // Show probabilities section only for car predictions
            this.safeSetDisplay(this.probabilitiesBox, 'block');

            // Set probabilities only if available and valid
            const probabilities = prediction.class_probabilities || prediction.all_probabilities;
            if (probabilities && Object.keys(probabilities).length > 0) {
                console.log('Displaying probabilities for car prediction');
                this.displayProbabilities(probabilities);
            } else {
                // If no probabilities available, hide the section
                this.safeSetDisplay(this.probabilitiesBox, 'none');
            }
        }

        this.showZone('results');
    }


    displayProbabilities(probabilities) {
        if (!this.probabilitiesList) return;

        this.probabilitiesList.innerHTML = '';

        const sortedProbs = Object.entries(probabilities)
            .sort(([, a], [, b]) => b - a);

        sortedProbs.forEach(([className, probability]) => {
            const item = document.createElement('div');
            item.className = 'probability-item';

            const percentage = (probability * 100).toFixed(1);

            item.innerHTML = `
                <span class="probability-name">${className.replace(/_/g, ' ')}</span>
                <div class="probability-bar">
                    <div class="probability-fill" style="width: ${percentage}%"></div>
                </div>
                <span class="probability-percent">${percentage}%</span>
            `;

            this.probabilitiesList.appendChild(item);
        });
    }

    showError(message) {
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
        }
        this.showZone('error');
    }

    showZone(zone) {
        // Hide all zones safely
        this.safeSetDisplay(this.uploadZone, 'none');
        this.safeSetDisplay(this.previewZone, 'none');
        this.safeSetDisplay(this.processingZone, 'none');
        this.safeSetDisplay(this.resultsZone, 'none');
        this.safeSetDisplay(this.errorZone, 'none');

        // Show selected zone safely
        switch (zone) {
            case 'upload':
                this.safeSetDisplay(this.uploadZone, 'flex');
                break;
            case 'preview':
                this.safeSetDisplay(this.previewZone, 'flex');
                break;
            case 'processing':
                this.safeSetDisplay(this.processingZone, 'flex');
                break;
            case 'results':
                this.safeSetDisplay(this.resultsZone, 'block');
                break;
            case 'error':
                this.safeSetDisplay(this.errorZone, 'flex');
                break;
        }
    }

    resetApp() {
        this.selectedFile = null;
        if (this.fileInput) {
            this.fileInput.value = '';
        }
        this.showZone('upload');
    }
}

// Initialize app - SINGLE initialization only
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    new CarClassifierApp();
});
