class CarClassifierApp {
    constructor() {
        // Use relative URLs since we're on the same server now
        this.apiBaseUrl = '';
        this.selectedFile = null;
        this.initializeElements();
        this.setupEventListeners();
        this.checkApiHealth();
    }

    initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.previewSection = document.getElementById('previewSection');
        this.imagePreview = document.getElementById('imagePreview');
        this.predictBtn = document.getElementById('predictBtn');
        this.loadingSection = document.getElementById('loadingSection');
        this.resultsSection = document.getElementById('resultsSection');
        this.errorSection = document.getElementById('errorSection');
        this.predictedClass = document.getElementById('predictedClass');
        this.confidence = document.getElementById('confidence');
        this.probabilitiesList = document.getElementById('probabilitiesList');
        this.probabilitiesSection = document.getElementById('probabilitiesSection');
        this.resetBtn = document.getElementById('resetBtn');
        this.retryBtn = document.getElementById('retryBtn');
        this.errorMessage = document.getElementById('errorMessage');
    }

    setupEventListeners() {
        // File upload events
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Button events
        this.predictBtn.addEventListener('click', () => this.classifyImage());
        this.resetBtn.addEventListener('click', () => this.resetApp());
        this.retryBtn.addEventListener('click', () => this.hideError());
    }

    async checkApiHealth() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            console.log('API Health:', data);
        } catch (error) {
            console.error('API Health Check Failed:', error);
            this.showError('Cannot connect to the classification service.');
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    handleFile(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('Image file is too large. Please select an image smaller than 10MB.');
            return;
        }

        this.selectedFile = file;
        this.showImagePreview(file);
    }

    showImagePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.imagePreview.src = e.target.result;
            this.showSection('previewSection');
            this.hideOtherSections(['previewSection']);
        };
        reader.readAsDataURL(file);
    }

    async classifyImage() {
        if (!this.selectedFile) {
            this.showError('Please select an image first.');
            return;
        }

        this.showSection('loadingSection');
        this.hideOtherSections(['loadingSection']);

        try {
            const formData = new FormData();
            formData.append('file', this.selectedFile);

            const response = await fetch('/predict', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
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
        // Display predicted class and confidence
        this.predictedClass.textContent = prediction.predicted_class.replace(/_/g, ' ');
        this.confidence.textContent = `${(prediction.confidence * 100).toFixed(1)}%`;

        // Handle probabilities - check both possible keys
        const probabilities = prediction.class_probabilities || prediction.all_probabilities;
        
        if (probabilities && prediction.predicted_class !== "Not a Car") {
            this.displayProbabilities(probabilities);
            this.probabilitiesSection.style.display = 'block';
        } else {
            this.probabilitiesSection.style.display = 'none';
        }

        this.showSection('resultsSection');
        this.hideOtherSections(['resultsSection']);
    }

    displayProbabilities(probabilities) {
        this.probabilitiesList.innerHTML = '';

        // Convert to array and sort probabilities in descending order
        const sortedProbs = Object.entries(probabilities)
            .sort(([,a], [,b]) => b - a);

        sortedProbs.forEach(([className, probability]) => {
            const probabilityItem = document.createElement('div');
            probabilityItem.className = 'probability-item';

            const percentage = (probability * 100).toFixed(1);
            
            probabilityItem.innerHTML = `
                <span>${className.replace(/_/g, ' ')}</span>
                <div class="probability-bar">
                    <div class="probability-fill" style="width: ${percentage}%"></div>
                </div>
                <span>${percentage}%</span>
            `;

            this.probabilitiesList.appendChild(probabilityItem);
        });
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.showSection('errorSection');
        this.hideOtherSections(['errorSection']);
    }

    hideError() {
        this.hideSection('errorSection');
        if (this.selectedFile) {
            this.showSection('previewSection');
        }
    }

    resetApp() {
        this.selectedFile = null;
        this.fileInput.value = '';
        this.hideAllSections();
    }

    showSection(sectionId) {
        document.getElementById(sectionId).style.display = 'block';
    }

    hideSection(sectionId) {
        document.getElementById(sectionId).style.display = 'none';
    }

    hideOtherSections(keepVisible = []) {
        const sections = ['previewSection', 'loadingSection', 'resultsSection', 'errorSection'];
        sections.forEach(section => {
            if (!keepVisible.includes(section)) {
                this.hideSection(section);
            }
        });
    }

    hideAllSections() {
        this.hideOtherSections([]);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CarClassifierApp();
});
