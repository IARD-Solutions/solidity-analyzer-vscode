(function() {
    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // Global state
    let state = {
        vulnerabilities: window.vulnerabilities || [],
        linterResults: window.linterResults || [],
        filters: {
            confidence: 'all'
        },
        activeImpacts: new Set(['Critical', 'High', 'Medium', 'Low', 'Informational', 'Optimization']), // All active by default
        activeCategories: new Set(['Security', 'Gas Consumption', 'Best Practice', 'Style Guide', 'Miscellaneous']), // All active by default
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
        state.activeCategories = new Set(previousState.activeCategories || 
                                      ['Security', 'Gas Consumption', 'Best Practice', 'Style Guide', 'Miscellaneous']);
    }
    
    // Save state
    function saveState() {
        vscode.setState({
            filters: state.filters,
            expandedItems: Array.from(state.expandedItems),
            activeImpacts: Array.from(state.activeImpacts),
            activeCategories: Array.from(state.activeCategories)
        });
    }
    
    // Helper functions
    function toggleItemExpansion(element) {
        const listItem = element.closest('li');
        if (!listItem) return;
        
        listItem.classList.toggle('expanded');
        
        // Toggle the arrow icon
        const arrow = listItem.querySelector('.arrow');
        if (arrow) {
            arrow.classList.toggle('expanded');
        }
        
        // Toggle the details visibility
        const details = listItem.querySelector('.vulnerability-details');
        if (details) {
            details.classList.toggle('expanded');
        }
        
        // Find the ID or index for state tracking
        const index = parseInt(listItem.dataset.index, 10);
        const itemId = (listItem.classList.contains('vulnerability-item')) 
            ? (state.vulnerabilities[index]?.id || `vuln-${index}`)
            : `lint-${index}`;
        
        if (listItem.classList.contains('expanded')) {
            state.expandedItems.add(itemId);
        } else {
            state.expandedItems.delete(itemId);
        }
        
        saveState();
    }
    
    // Make toggleItemExpansion available to the global scope for inline onclick handlers
    window.toggleItemExpansion = toggleItemExpansion;
    
    function getCategoryClass(category) {
        if (!category) return "misc";
        
        switch(category) {
            case "Security": return "security";
            case "Gas Consumption": return "gas";
            case "Best Practice": return "best-practice";
            case "Style Guide": return "style";
            default: return "misc";
        }
    }
    
    function getSeverityText(severity) {
        switch(severity) {
            case 0: return "Info";
            case 1: return "Warning";
            case 2: return "Error";
            default: return "Unknown";
        }
    }
    
    function toggleTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');
        document.getElementById(`${tabName}-tab`)?.classList.add('active');
        
        // If switching to linter tab, ensure linter list is rendered
        if (tabName === 'linter') {
            renderLinterResults();
        } else if (tabName === 'vulnerabilities') {
            renderVulnerabilityList();
        }
    }
    
    function createSeverityBadge(impact) {
        const badge = document.createElement('span');
        badge.classList.add('severity-badge', impact.toLowerCase());
        badge.textContent = impact;
        return badge;
    }
    
    // New function to group items by category/impact
    function groupItemsByProperty(items, propertyName) {
        const groups = {};
        
        items.forEach(item => {
            const value = item[propertyName] || 'Unknown';
            if (!groups[value]) {
                groups[value] = [];
            }
            groups[value].push(item);
        });
        
        return groups;
    }
    
    // Vulnerability rendering
    function filterVulnerabilities() {
        return state.vulnerabilities.filter(vuln => {
            const impactActive = state.activeImpacts.has(vuln.impact);
            const confidenceMatch = state.filters.confidence === 'all' || vuln.confidence === state.filters.confidence;
            return impactActive && confidenceMatch;
        });
    }
    
    function renderVulnerabilityList() {
        const vulnerabilityList = document.getElementById('vulnerability-list');
        const loadingElement = document.getElementById('loading');
        const noResultsElement = document.getElementById('no-results');
        const vulnerabilityCountElement = document.getElementById('vulnerability-count');
        
        if (!vulnerabilityList || !loadingElement || !noResultsElement) {
            console.error("Required DOM elements for vulnerability rendering not found");
            return;
        }
        
        // Show loading state
        loadingElement.style.display = 'flex';
        vulnerabilityList.innerHTML = '';
        
        // Process after a small delay to allow the UI to update with loading indicator
        setTimeout(() => {
            try {
                const filteredVulnerabilities = filterVulnerabilities();
                
                // Calculate total issues (vulnerabilities + linter issues)
                const totalIssues = state.vulnerabilities.length + state.linterResults.length;
                
                // Update the total count in the header (not just vulnerability count)
                if (vulnerabilityCountElement) {
                    vulnerabilityCountElement.textContent = totalIssues;
                }
                
                // Update just the vulnerability tab badge
                const vulnTabBadge = document.querySelector('.tab[data-tab="vulnerabilities"] .tab-badge');
                if (vulnTabBadge) {
                    vulnTabBadge.textContent = filteredVulnerabilities.length;
                }
                
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
                
                // Group vulnerabilities by impact
                const groupedVulns = groupItemsByProperty(filteredVulnerabilities, 'impact');
                
                // Sort the groups by severity
                const sortedGroups = Object.keys(groupedVulns).sort((a, b) => {
                    const orderA = severityOrder[a] !== undefined ? severityOrder[a] : 999;
                    const orderB = severityOrder[b] !== undefined ? severityOrder[b] : 999;
                    return orderA - orderB;
                });
                
                // Create category groups for each impact level
                sortedGroups.forEach(impact => {
                    const items = groupedVulns[impact];
                    
                    // Create group header
                    const groupHeader = document.createElement('div');
                    groupHeader.className = 'category-group-header';
                    groupHeader.innerHTML = `
                        <span>${impact}</span>
                        <span class="count">${items.length}</span>
                    `;
                    
                    vulnerabilityList.appendChild(groupHeader);
                    
                    // Add vulnerabilities in this group
                    items.forEach((vuln, index) => {
                        const li = document.createElement('li');
                        li.className = `vulnerability-item impact-${(vuln.impact || 'medium').toLowerCase()}`;
                        li.dataset.index = filteredVulnerabilities.indexOf(vuln);
                        
                        // Get the first affected location for display
                        const location = vuln.lines && vuln.lines.length > 0 
                            ? `${vuln.lines[0].contract}: Line ${vuln.lines[0].lines[0]}` 
                            : 'Location unknown';
                        
                        li.innerHTML = `
                            <div class="vulnerability-header" onclick="toggleItemExpansion(this)">
                                <div class="vulnerability-title">
                                    <span class="arrow codicon codicon-chevron-right"></span>
                                    <strong>${vuln.title || vuln.check}</strong>
                                </div>
                                <div class="vulnerability-meta">
                                    <span class="vulnerability-location">${location}</span>
                                </div>
                            </div>
                            <div class="vulnerability-details">
                                <table class="detail-table">
                                    <tr>
                                        <td>Confidence:</td>
                                        <td>${vuln.confidence || 'Medium'}</td>
                                    </tr>
                                    <tr>
                                        <td>Description:</td>
                                        <td>${vuln.description || 'No description available'}</td>
                                    </tr>
                                </table>
                                <div class="vulnerability-actions">
                                    <button class="action-button focus-button" data-index="${li.dataset.index}" title="Focus on vulnerability in code">
                                        <span class="codicon codicon-selection"></span> Focus
                                    </button>
                                </div>
                            </div>
                        `;
                        
                        // Check if this item should be expanded
                        if (state.expandedItems.has(vuln.id || `vuln-${li.dataset.index}`)) {
                            li.classList.add('expanded');
                            li.querySelector('.arrow')?.classList.add('expanded');
                            li.querySelector('.vulnerability-details')?.classList.add('expanded');
                        }
                        
                        vulnerabilityList.appendChild(li);
                    });
                });
                
                // Add event listeners for focus buttons
                document.querySelectorAll('#vulnerability-list .focus-button').forEach(button => {
                    button.addEventListener('click', function(e) {
                        e.stopPropagation(); // Don't toggle expansion
                        const index = parseInt(this.dataset.index, 10);
                        if (index >= 0 && index < filteredVulnerabilities.length) {
                            console.log('Focusing on vulnerability:', filteredVulnerabilities[index]);
                            vscode.postMessage({
                                command: 'focusOnVulnerability',
                                vulnerability: filteredVulnerabilities[index]
                            });
                        }
                    });
                });
                
                // Add event listeners for group headers to collapse/expand groups
                document.querySelectorAll('.category-group-header').forEach(header => {
                    header.addEventListener('click', function() {
                        const nextSibling = this.nextElementSibling;
                        let current = nextSibling;
                        
                        // Toggle visibility of all items until the next header
                        while (current && !current.classList.contains('category-group-header')) {
                            current.style.display = current.style.display === 'none' ? '' : 'none';
                            current = current.nextElementSibling;
                        }
                    });
                });
                
            } catch (error) {
                console.error('Error rendering vulnerabilities:', error);
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
    
    // Linter rendering
    function renderLinterResults() {
        const linterList = document.getElementById('linter-list');
        const linterLoading = document.getElementById('linter-loading');
        const linterNoResults = document.getElementById('linter-no-results');
        
        if (!linterList) {
            console.error('Linter list element not found');
            return;
        }
        
        // Show loading indicator
        if (linterLoading) linterLoading.style.display = 'flex';
        linterList.innerHTML = '';
        
        try {
            // Get active category filters
            const activeCategories = Array.from(state.activeCategories);
            
            // Filter linter results
            const filteredResults = state.linterResults.filter(result => 
                activeCategories.length === 0 || activeCategories.includes(result.category)
            );
            
            // Update just the linter tab badge
            const linterTabBadge = document.querySelector('.tab[data-tab="linter"] .tab-badge');
            if (linterTabBadge) {
                linterTabBadge.textContent = filteredResults.length;
            }
            
            console.log(`Rendering ${filteredResults.length} linter results`);
            
            // Update UI based on results
            if (filteredResults.length === 0) {
                if (linterNoResults) linterNoResults.style.display = 'flex';
            } else {
                if (linterNoResults) linterNoResults.style.display = 'none';
                
                // Group linter results by category
                const groupedResults = groupItemsByProperty(filteredResults, 'category');
                
                // Sort the groups alphabetically
                const sortedGroups = Object.keys(groupedResults).sort();
                
                // Create category groups
                sortedGroups.forEach(category => {
                    const items = groupedResults[category];
                    
                    // Create group header
                    const groupHeader = document.createElement('div');
                    groupHeader.className = 'category-group-header';
                    groupHeader.innerHTML = `
                        <span>${category || 'Miscellaneous'}</span>
                        <span class="count">${items.length}</span>
                    `;
                    
                    linterList.appendChild(groupHeader);
                    
                    // Add linter issues in this group
                    items.forEach((result, index) => {
                        const li = document.createElement('li');
                        const categoryClass = getCategoryClass(result.category);
                        
                        li.className = `linter-item category-${categoryClass}`;
                        li.dataset.index = filteredResults.indexOf(result);
                        
                        // Create header element
                        const header = document.createElement('div');
                        header.className = 'vulnerability-header';
                        header.onclick = function() { toggleItemExpansion(this); };
                        
                        // Create title div with appropriate styling
                        const titleDiv = document.createElement('div');
                        titleDiv.className = 'vulnerability-title';
                        
                        const arrow = document.createElement('span');
                        arrow.className = 'arrow codicon codicon-chevron-right';
                        titleDiv.appendChild(arrow);
                        
                        const title = document.createElement('strong');
                        title.textContent = result.ruleId ? result.ruleId.replace(/-/g, ' ') : 'Unknown Rule';
                        titleDiv.appendChild(title);
                        
                        header.appendChild(titleDiv);
                        
                        // Create metadata div (without severity)
                        const metaDiv = document.createElement('div');
                        metaDiv.className = 'vulnerability-meta';
                        
                        const locationSpan = document.createElement('span');
                        locationSpan.className = 'vulnerability-location';
                        const fileName = result.filePath ? result.filePath.split('/').pop() : 'Unknown';
                        locationSpan.textContent = `${fileName}: Line ${result.line}${result.column ? ', Col ' + result.column : ''}`;
                        metaDiv.appendChild(locationSpan);
                        
                        header.appendChild(metaDiv);
                        li.appendChild(header);
                        
                        // Create details section with better formatting
                        const details = document.createElement('div');
                        details.className = 'vulnerability-details';
                        
                        const table = document.createElement('table');
                        table.className = 'detail-table';
                        
                        // Add severity row (moved from header)
                        const severityRow = document.createElement('tr');
                        const severityLabel = document.createElement('td');
                        severityLabel.textContent = 'Severity:';
                        severityRow.appendChild(severityLabel);
                        
                        const severityValue = document.createElement('td');
                        severityValue.textContent = getSeverityText(result.severity);
                        severityRow.appendChild(severityValue);
                        
                        table.appendChild(severityRow);
                        
                        // Add message row
                        const messageRow = document.createElement('tr');
                        const messageLabel = document.createElement('td');
                        messageLabel.textContent = 'Message:';
                        messageRow.appendChild(messageLabel);
                        
                        const messageValue = document.createElement('td');
                        messageValue.textContent = result.message || 'No description available';
                        messageRow.appendChild(messageValue);
                        
                        table.appendChild(messageRow);
                        details.appendChild(table);
                        
                        // Create actions area with better positioning of buttons
                        const actions = document.createElement('div');
                        actions.className = 'vulnerability-actions';
                        
                        const focusButton = document.createElement('button');
                        focusButton.className = 'action-button focus-button';
                        focusButton.dataset.index = li.dataset.index;
                        focusButton.innerHTML = `
                            <span class="codicon codicon-selection"></span> Focus
                        `;
                        
                        // Create a more visible ignore rule button
                        const ignoreButton = document.createElement('button');
                        ignoreButton.className = 'action-button ignore-button';
                        ignoreButton.dataset.ruleId = result.ruleId;
                        ignoreButton.title = `Ignore ${result.ruleId} rule in future analyses`;
                        ignoreButton.innerHTML = `
                            <span class="codicon codicon-mute"></span> Ignore Rule
                        `;
                        
                        // Set up event handlers for buttons
                        focusButton.addEventListener('click', function(e) {
                            e.stopPropagation(); // Don't toggle expansion
                            const index = parseInt(this.dataset.index, 10);
                            if (index >= 0 && index < filteredResults.length) {
                                vscode.postMessage({
                                    command: 'focusOnLinterIssue',
                                    linterIssue: filteredResults[index]
                                });
                            }
                        });
                        
                        ignoreButton.addEventListener('click', function(e) {
                            e.stopPropagation(); // Don't toggle expansion
                            const ruleId = this.dataset.ruleId;
                            if (ruleId) {
                                vscode.postMessage({
                                    command: 'ignoreLinterRule',
                                    ruleId: ruleId
                                });
                            }
                        });
                        
                        // Add both buttons to the actions area
                        actions.appendChild(focusButton);
                        actions.appendChild(ignoreButton);
                        details.appendChild(actions);
                        
                        li.appendChild(details);
                        
                        // Apply expansion state if needed
                        if (state.expandedItems.has(`lint-${li.dataset.index}`)) {
                            li.classList.add('expanded');
                            arrow.classList.add('expanded');
                            details.classList.add('expanded');
                        }
                        
                        linterList.appendChild(li);
                    });
                });
                
                // Add event listeners for group headers to collapse/expand groups
                document.querySelectorAll('.category-group-header').forEach(header => {
                    header.addEventListener('click', function() {
                        const nextSibling = this.nextElementSibling;
                        let current = nextSibling;
                        
                        // Toggle visibility of all items until the next header
                        while (current && !current.classList.contains('category-group-header')) {
                            current.style.display = current.style.display === 'none' ? '' : 'none';
                            current = current.nextElementSibling;
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Error rendering linter results:', error);
            vscode.postMessage({ 
                command: 'logError', 
                error: `Error rendering linter results: ${error.message}` 
            });
        } finally {
            // Hide loading indicator
            if (linterLoading) linterLoading.style.display = 'none';
        }
    }
    
    // Add message listener to handle rule ignore updates from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'ruleIgnored':
                // When a rule is ignored, update the UI to hide matching rules
                const ruleId = message.ruleId;
                if (ruleId) {
                    console.log(`Rule ignored: ${ruleId}. Updating UI.`);
                    
                    // Find all linter items with this rule ID
                    const itemsToRemove = [];
                    const linterItems = document.querySelectorAll('.linter-item');
                    linterItems.forEach(item => {
                        // Find the associated linter result
                        const index = parseInt(item.dataset.index, 10);
                        if (index >= 0 && index < state.linterResults.length) {
                            const result = state.linterResults[index];
                            if (result.ruleId === ruleId) {
                                itemsToRemove.push(item);
                                // Store the item data so we can restore it later if needed
                                item.dataset.ruleData = JSON.stringify(result);
                            }
                        }
                    });
                    
                    // Remove items with animations
                    let removedCount = 0;
                    itemsToRemove.forEach(item => {
                        item.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
                        item.style.opacity = '0';
                        item.style.maxHeight = '0';
                        item.style.overflow = 'hidden';
                        item.style.marginBottom = '0';
                        
                        // Remove from DOM after animation finishes
                        setTimeout(() => {
                            // Instead of removing, hide the item and add a data attribute to mark it as ignored
                            item.classList.add('ignored-rule');
                            item.style.display = 'none';
                            
                            removedCount++;
                            
                            // If all items are removed, check if we need to update category headers
                            if (removedCount === itemsToRemove.length) {
                                updateCategoryHeaders();
                                updateLinterCount();
                            }
                        }, 300);
                    });
                }
                break;
                
            case 'ruleRestored':
                // When a rule is restored (undo ignore), show it again in the UI
                const restoredRuleId = message.ruleId;
                if (restoredRuleId) {
                    console.log(`Rule restored: ${restoredRuleId}. Updating UI.`);
                    
                    // Find all hidden items with this rule ID
                    const ignoredItems = document.querySelectorAll(`.ignored-rule`);
                    const itemsToRestore = [];
                    
                    ignoredItems.forEach(item => {
                        // Try to get the stored rule data
                        try {
                            const ruleData = JSON.parse(item.dataset.ruleData || '{}');
                            if (ruleData.ruleId === restoredRuleId) {
                                itemsToRestore.push(item);
                            }
                        } catch (e) {
                            console.error('Error parsing rule data:', e);
                        }
                    });
                    
                    // Restore items with animations
                    if (itemsToRestore.length > 0) {
                        itemsToRestore.forEach(item => {
                            // Reset the item styling
                            item.classList.remove('ignored-rule');
                            item.style.display = '';
                            item.style.maxHeight = '';
                            item.style.overflow = '';
                            item.style.marginBottom = '';
                            
                            // Animate it back in
                            setTimeout(() => {
                                item.style.opacity = '1';
                            }, 10);
                        });
                        
                        // Update the UI after restoring items
                        updateCategoryHeaders();
                        updateLinterCount();
                    } else {
                        // If no items were found to restore, we might need to re-analyze
                        console.log('No items found to restore, consider re-analyzing');
                    }
                }
                break;
        }
    });
    
    // Helper function to update category headers after items are removed
    function updateCategoryHeaders() {
        // Get all category headers
        const headers = document.querySelectorAll('.category-group-header');
        
        headers.forEach(header => {
            const categoryName = header.querySelector('span:first-child').textContent;
            const nextItem = header.nextElementSibling;
            
            // If next element isn't a linter item or no next element, remove the header
            if (!nextItem || !nextItem.classList.contains('linter-item')) {
                header.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
                header.style.opacity = '0';
                header.style.maxHeight = '0';
                header.style.overflow = 'hidden';
                header.style.marginTop = '0';
                header.style.marginBottom = '0';
                
                setTimeout(() => {
                    header.remove();
                }, 300);
            } else {
                // Count remaining items in this category
                let count = 0;
                let current = nextItem;
                
                while (current && current.classList.contains('linter-item')) {
                    count++;
                    current = current.nextElementSibling;
                }
                
                // Update the count in the header
                const countElement = header.querySelector('.count');
                if (countElement) {
                    countElement.textContent = count;
                }
            }
        });
    }
    
    // Helper function to update the linter count in the tab after removing items
    function updateLinterCount() {
        // Update the linter tab badge
        const visibleItems = document.querySelectorAll('#linter-list .linter-item');
        const linterTabBadge = document.querySelector('.tab[data-tab="linter"] .tab-badge');
        
        if (linterTabBadge) {
            linterTabBadge.textContent = visibleItems.length;
        }
        
        // If no items left, show the "no results" message
        if (visibleItems.length === 0) {
            const noResultsElement = document.getElementById('linter-no-results');
            if (noResultsElement) {
                noResultsElement.style.display = 'flex';
            }
        }
    }
    
    // Initialize the UI
    function initializeUI() {
        // Get UI elements
        const dismissButton = document.getElementById('dismiss-button');
        const confidenceFilterSelect = document.getElementById('filter-confidence');
        const impactToggles = document.querySelectorAll('#impact-toggles .toggle-button');
        const categoryToggles = document.querySelectorAll('#category-toggles .toggle-button');
        const tabButtons = document.querySelectorAll('.tab');
        
        // Set filter values from state
        if (confidenceFilterSelect) {
            confidenceFilterSelect.value = state.filters.confidence;
        }
        
        // Set initial toggle button states
        impactToggles.forEach(toggle => {
            const impact = toggle.dataset.impact;
            if (!state.activeImpacts.has(impact)) {
                toggle.classList.add('disabled');
            }
        });
        
        categoryToggles.forEach(toggle => {
            const category = toggle.dataset.category;
            if (!state.activeCategories.has(category)) {
                toggle.classList.add('disabled');
            }
        });

        // Filter event handlers
        if (confidenceFilterSelect) {
            confidenceFilterSelect.addEventListener('change', function() {
                state.filters.confidence = this.value;
                renderVulnerabilityList();
                saveState();
            });
        }
        
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
        
        // Category toggle event handlers
        categoryToggles.forEach(toggle => {
            toggle.addEventListener('click', function() {
                const category = this.dataset.category;
                if (state.activeCategories.has(category)) {
                    state.activeCategories.delete(category);
                    this.classList.add('disabled');
                } else {
                    state.activeCategories.add(category);
                    this.classList.remove('disabled');
                }
                renderLinterResults();
                saveState();
            });
        });
        
        // Dismiss highlights button - ensure it works
        if (dismissButton) {
            dismissButton.addEventListener('click', function() {
                console.log('Dismiss button clicked, sending message to extension');
                vscode.postMessage({ command: 'dismissHighlights' });
            });
        }
        
        // Initialize tab switching
        tabButtons.forEach(tab => {
            tab.addEventListener('click', () => {
                toggleTab(tab.dataset.tab);
            });
        });
        
        // Make toggle function available globally
        window.toggleItemExpansion = toggleItemExpansion;
        
        // Initial render based on active tab
        const activeTab = document.querySelector('.tab.active');
        if (activeTab?.dataset.tab === 'linter') {
            renderLinterResults();
        } else {
            renderVulnerabilityList();
        }
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', initializeUI);
    
    // Initialize immediately if already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initializeUI();
    }
})();
