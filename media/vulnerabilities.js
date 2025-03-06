(function() {
    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // Keep track of the vulnerability list state
    let state = {
        vulnerabilities: vulnerabilities || [],
        filters: {
            confidence: 'all'
        },
        activeImpacts: new Set(['Critical', 'High', 'Medium', 'Low', 'Informational', 'Optimization']), // All active by default
        expandedItems: new Set()
    };
    
    // Try to restore state from VS Code storage
    const previousState = vscode.getState();
    if (previousState) {
        // Keep the vulnerabilities from the current load but restore UI state
        state.filters = previousState.filters || state.filters;
        state.expandedItems = new Set(previousState.expandedItems || []);
        state.activeImpacts = new Set(previousState.activeImpacts || 
                                     ['Critical', 'High', 'Medium', 'Low', 'Informational', 'Optimization']);
    }
    
    // Save state
    function saveState() {
        vscode.setState({
            filters: state.filters,
            expandedItems: Array.from(state.expandedItems),
            activeImpacts: Array.from(state.activeImpacts)
        });
    }
    
    // Initialize the UI
    function initializeUI() {
        const vulnerabilityList = document.getElementById('vulnerability-list');
        const loadingElement = document.getElementById('loading');
        const noResultsElement = document.getElementById('no-results');
        const vulnerabilityCountElement = document.getElementById('vulnerability-count');
        const dismissButton = document.getElementById('dismiss-button');
        const confidenceFilterSelect = document.getElementById('filter-confidence');
        const impactToggles = document.querySelectorAll('.toggle-button');
        
        // Set filter values from state
        confidenceFilterSelect.value = state.filters.confidence;
        
        // Set initial toggle button states
        impactToggles.forEach(toggle => {
            const impact = toggle.dataset.impact;
            if (!state.activeImpacts.has(impact)) {
                toggle.classList.add('disabled');
            }
        });

        // Filter event handlers
        confidenceFilterSelect.addEventListener('change', function() {
            state.filters.confidence = this.value;
            renderVulnerabilityList();
            saveState();
        });
        
        // Impact toggle event handlers
        impactToggles.forEach(toggle => {
            toggle.addEventListener('click', function() {
                const impact = this.dataset.impact;
                if (state.activeImpacts.has(impact)) {
                    state.activeImpacts.delete(impact);
                    this.classList.add('disabled');
                } else {
                    state.activeImpacts.add(impact);
                    this.classList.remove('disabled');
                }
                renderVulnerabilityList();
                saveState();
            });
        });
        
        // Dismiss highlights button
        dismissButton.addEventListener('click', function() {
            vscode.postMessage({ command: 'dismissHighlights' });
        });
        
        function createSeverityBadge(impact) {
            const badge = document.createElement('span');
            badge.classList.add('severity-badge', impact.toLowerCase());
            badge.textContent = impact;
            return badge;
        }
        
        function filterVulnerabilities() {
            return state.vulnerabilities.filter(vuln => {
                const impactActive = state.activeImpacts.has(vuln.impact);
                const confidenceMatch = state.filters.confidence === 'all' || vuln.confidence === state.filters.confidence;
                return impactActive && confidenceMatch;
            });
        }
        
        function renderVulnerabilityList() {
            // Show loading state
            loadingElement.style.display = 'flex';
            vulnerabilityList.innerHTML = '';
            
            // Process after a small delay to allow the UI to update with loading indicator
            setTimeout(() => {
                try {
                    const filteredVulnerabilities = filterVulnerabilities();
                    vulnerabilityCountElement.textContent = filteredVulnerabilities.length;
                    
                    // Handle no results
                    if (filteredVulnerabilities.length === 0) {
                        loadingElement.style.display = 'none';
                        noResultsElement.style.display = 'flex';
                        return;
                    }
                    
                    noResultsElement.style.display = 'none';
                    
                    // Sort vulnerabilities by severity with proper ordering
                    const severityOrder = { 
                        'Critical': 0, 
                        'High': 1, 
                        'Medium': 2, 
                        'Low': 3,
                        'Optimization': 4,
                        'Informational': 5 
                    };
                    
                    filteredVulnerabilities.sort((a, b) => {
                        // Default to end of list if impact isn't in the order mapping
                        const impactOrderA = severityOrder[a.impact] !== undefined ? severityOrder[a.impact] : 999;
                        const impactOrderB = severityOrder[b.impact] !== undefined ? severityOrder[b.impact] : 999;
                        return impactOrderA - impactOrderB;
                    });
                    
                    // Create list items for each vulnerability
                    filteredVulnerabilities.forEach((vuln, index) => {
                        const listItem = document.createElement('li');
                        listItem.classList.add('vulnerability-item');
                        listItem.dataset.index = index;
                        
                        // Create header
                        const header = document.createElement('div');
                        header.classList.add('vulnerability-header');
                        header.addEventListener('click', toggleDetails);
                        
                        // Create title
                        const title = document.createElement('h3');
                        title.classList.add('vulnerability-title');
                        title.textContent = vuln.check;
                        
                        // Add impact badge to title
                        title.appendChild(createSeverityBadge(vuln.impact));
                        
                        // Add arrow for toggle
                        const arrow = document.createElement('span');
                        arrow.classList.add('codicon', 'codicon-chevron-right', 'arrow');
                        if (state.expandedItems.has(vuln.id || index)) {
                            arrow.classList.add('expanded');
                        }
                        header.prepend(arrow);
                        
                        // Assemble header
                        header.appendChild(title);
                        listItem.appendChild(header);
                        
                        // Create details container
                        const details = document.createElement('div');
                        details.classList.add('vulnerability-details');
                        if (state.expandedItems.has(vuln.id || index)) {
                            details.classList.add('expanded');
                        }
                        
                        // Add impact and confidence
                        const confidenceRow = createDetailRow('Confidence', vuln.confidence);
                        details.appendChild(confidenceRow);
                        
                        // Add description
                        const descriptionRow = createDetailRow('Description', vuln.description);
                        descriptionRow.querySelector('.detail-value').classList.add('clickable');
                        descriptionRow.querySelector('.detail-value').addEventListener('click', (e) => {
                            e.stopPropagation();
                            focusOnVulnerability(vuln);
                        });
                        details.appendChild(descriptionRow);
                        
                        listItem.appendChild(details);
                        vulnerabilityList.appendChild(listItem);
                    });
                    
                } catch (error) {
                    vscode.postMessage({ command: 'logError', error: error.message });
                    
                    const errorMessage = document.createElement('div');
                    errorMessage.classList.add('message-container');
                    errorMessage.innerHTML = `
                        <span class="codicon codicon-error"></span>
                        <p>An error occurred while rendering vulnerabilities</p>
                    `;
                    vulnerabilityList.appendChild(errorMessage);
                    
                } finally {
                    loadingElement.style.display = 'none';
                }
            }, 50);
        }
        
        function createDetailRow(label, value) {
            const row = document.createElement('div');
            row.classList.add('detail-row');
            
            const labelElement = document.createElement('span');
            labelElement.classList.add('detail-label');
            labelElement.textContent = label;
            
            const valueElement = document.createElement('p');
            valueElement.classList.add('detail-value');
            valueElement.textContent = value;
            
            row.appendChild(labelElement);
            row.appendChild(valueElement);
            return row;
        }
        
        function toggleDetails(event) {
            const listItem = event.currentTarget.closest('.vulnerability-item');
            const index = parseInt(listItem.dataset.index, 10);
            const vuln = state.vulnerabilities[index];
            const vulnId = vuln.id || index;
            
            const arrow = listItem.querySelector('.arrow');
            const details = listItem.querySelector('.vulnerability-details');
            
            if (details.classList.contains('expanded')) {
                details.classList.remove('expanded');
                arrow.classList.remove('expanded');
                state.expandedItems.delete(vulnId);
            } else {
                details.classList.add('expanded');
                arrow.classList.add('expanded');
                state.expandedItems.add(vulnId);
            }
            
            saveState();
        }
        
        function focusOnVulnerability(vulnerability) {
            vscode.postMessage({
                command: 'focusOnVulnerability',
                vulnerability: vulnerability
            });
        }
        
        // Initial render
        renderVulnerabilityList();
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', initializeUI);
    
    // Initialize immediately if already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initializeUI();
    }
})();
