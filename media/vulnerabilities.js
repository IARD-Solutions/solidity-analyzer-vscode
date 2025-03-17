/**
 * Vulnerabilities Panel Webview Script
 * 
 * This script manages the UI for displaying Solidity code analysis results in the VS Code webview panel.
 * It handles rendering of both security vulnerabilities and linter issues, along with filtering, 
 * categorization, and interactive elements for navigating analysis results.
 * 
 * Features:
 * - Display of vulnerabilities grouped by impact level
 * - Display of linter results grouped by category
 * - Filtering by confidence level and impact
 * - Expandable/collapsible item details
 * - Focus functionality to navigate to issues in code
 * - Persistent state for UI preferences
 */
(function () {
    // Get VS Code API
    const vscode = acquireVsCodeApi();

    // Global state
    let state = {
        vulnerabilities: window.vulnerabilities || [],
        linterResults: window.linterResults || [],
        settings: window.settings || {
            showExplanations: true,
            showRecommendations: true,
            enableLinting: true
        },
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

    /**
     * Saves current UI state to VS Code's state storage
     */
    function saveState() {
        vscode.setState({
            filters: state.filters,
            expandedItems: Array.from(state.expandedItems),
            activeImpacts: Array.from(state.activeImpacts),
            activeCategories: Array.from(state.activeCategories)
        });
    }

    // Helper functions
    /**
     * Toggles the expansion state of a vulnerability or linter item
     *
     * @param {HTMLElement} element - The element that was clicked
     */
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

    /**
     * Determines the CSS class for a category
     * 
     * @param {string} category - The category name
     * @returns {string} - The corresponding CSS class
     */
    function getCategoryClass(category) {
        if (!category) return "misc";

        switch (category) {
            case "Security": return "security";
            case "Gas Consumption": return "gas";
            case "Best Practice": return "best-practice";
            case "Style Guide": return "style";
            default: return "misc";
        }
    }

    /**
     * Maps numeric severity levels to text representations
     * 
     * @param {number} severity - The numeric severity level
     * @returns {string} - Text representation of the severity
     */
    function getSeverityText(severity) {
        switch (severity) {
            case 0: return "Info";
            case 1: return "Warning";
            case 2: return "Error";
            default: return "Unknown";
        }
    }

    /**
     * Switches between tabs in the UI
     * 
     * @param {string} tabName - The name of the tab to activate
     */
    function toggleTab(tabName) {
        // Don't do anything if linting is disabled and trying to access linter tab
        if (tabName === 'linter' && !state.settings.enableLinting) {
            return;
        }

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

    /**
     * Handles collapsing/expanding category headers
     * 
     * @param {HTMLElement} header - The header element that was clicked
     */
    function toggleCategoryGroup(header) {
        const headerStyle = window.getComputedStyle(header);
        const headerPadding = headerStyle.paddingLeft;
        let current = header.nextElementSibling;

        // Check if header is already collapsed (we'll use a data attribute to track state)
        const isCollapsed = header.dataset.collapsed === "true";

        // Toggle the collapsed state
        header.dataset.collapsed = isCollapsed ? "false" : "true";

        // Find all elements under this header until we hit another header of the same level
        const childElements = [];
        while (current &&
            (!current.classList.contains('category-group-header') ||
                window.getComputedStyle(current).paddingLeft !== headerPadding)) {
            childElements.push(current);
            current = current.nextElementSibling;
        }

        // Apply the display style based on the new collapsed state
        const newDisplayStyle = isCollapsed ? "" : "none";
        childElements.forEach(element => {
            element.style.display = newDisplayStyle;
        });
    }

    /**
     * Creates a severity badge UI element
     * 
     * @param {string} impact - The impact level (Critical, High, etc.)
     * @returns {HTMLElement} - The badge element
     */
    function createSeverityBadge(impact) {
        const badge = document.createElement('span');
        badge.classList.add('severity-badge', impact.toLowerCase());
        badge.textContent = impact;
        return badge;
    }

    /**
     * Groups items by a specified property
     * 
     * @param {Array} items - The array of items to group
     * @param {string} propertyName - The property to group by
     * @returns {Object} - Object with grouped items
     */
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

    /**
     * Filters vulnerabilities based on current UI filters.
     * Applies confidence level and impact filters from the state.
     * 
     * @returns {Array} - Array of filtered vulnerability objects
     */
    function filterVulnerabilities() {
        return state.vulnerabilities.filter(vuln => {
            const impactActive = state.activeImpacts.has(vuln.impact);
            const confidenceMatch = state.filters.confidence === 'all' || vuln.confidence === state.filters.confidence;
            return impactActive && confidenceMatch;
        });
    }

    /**
     * Renders the vulnerability list in the UI.
     * Groups vulnerabilities by impact level and applies current filters.
     * Creates expandable UI elements for each vulnerability.
     */
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

                // First group vulnerabilities by file
                const fileGroups = {};

                filteredVulnerabilities.forEach(vuln => {
                    // Extract file from the first location or from the description
                    let filePath = 'Unknown File';

                    if (vuln.lines && vuln.lines.length > 0) {
                        filePath = vuln.lines[0].contract || 'Unknown File';
                    } else if (vuln.description) {
                        // Try to extract file path from description if not in lines
                        const fileMatch = vuln.description.match(/([^\s()]+\.sol)/);
                        if (fileMatch) {
                            filePath = fileMatch[1];
                        }
                    }

                    if (!fileGroups[filePath]) {
                        fileGroups[filePath] = {};
                    }

                    // Then group by impact within each file
                    const impact = vuln.impact || 'Unknown';
                    if (!fileGroups[filePath][impact]) {
                        fileGroups[filePath][impact] = [];
                    }

                    fileGroups[filePath][impact].push(vuln);
                });

                // Sort the groups by severity
                const severityOrder = {
                    'Critical': 0,
                    'High': 1,
                    'Medium': 2,
                    'Low': 3,
                    'Optimization': 4,
                    'Informational': 5
                };

                // Now render the file groups
                Object.keys(fileGroups).sort().forEach(filePath => {
                    // Add file header
                    const fileHeader = document.createElement('div');
                    fileHeader.className = 'category-group-header';
                    fileHeader.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                    fileHeader.style.padding = '10px';
                    fileHeader.style.fontWeight = 'bold';
                    fileHeader.style.marginTop = '20px';

                    // Count vulnerabilities in this file
                    let fileVulnCount = 0;
                    Object.values(fileGroups[filePath]).forEach(group => {
                        fileVulnCount += group.length;
                    });

                    fileHeader.innerHTML = `
                        <span>${filePath}</span>
                        <span class="count">${fileVulnCount}</span>
                    `;
                    vulnerabilityList.appendChild(fileHeader);

                    // Sort impacts by severity for this file
                    const sortedImpacts = Object.keys(fileGroups[filePath]).sort((a, b) => {
                        const orderA = severityOrder[a] !== undefined ? severityOrder[a] : 999;
                        const orderB = severityOrder[b] !== undefined ? severityOrder[b] : 999;
                        return orderA - orderB;
                    });

                    // Add impacts within this file
                    sortedImpacts.forEach(impact => {
                        const items = fileGroups[filePath][impact];

                        // Create impact subgroup header
                        const impactHeader = document.createElement('div');
                        impactHeader.className = 'category-group-header';
                        impactHeader.style.paddingLeft = '24px'; // Indent for hierarchy
                        impactHeader.innerHTML = `
                            <span>${impact}</span>
                            <span class="count">${items.length}</span>
                        `;
                        vulnerabilityList.appendChild(impactHeader);

                        // Add vulnerabilities in this impact group
                        items.forEach(vuln => {
                            // ...existing code to render individual vulnerability items...
                            // Rest of your vulnerability item creation code
                            const li = document.createElement('li');
                            li.className = `vulnerability-item impact-${(vuln.impact || 'medium').toLowerCase()}`;
                            li.dataset.index = filteredVulnerabilities.indexOf(vuln);
                            li.style.marginLeft = '24px'; // Indent items under the impact

                            // ...rest of your existing vulnerability item rendering code...
                            const location = vuln.lines && vuln.lines.length > 0
                                ? `${vuln.lines[0].contract}: Line ${vuln.lines[0].lines[0]}`
                                : 'Location unknown';

                            // Create recommendation section if available and enabled
                            let recommendationHtml = '';
                            if (state.settings.showRecommendations && vuln.recommendation) {
                                recommendationHtml = `
                                    <div class="recommendation-box">
                                        <div class="recommendation-heading">
                                            <span class="codicon codicon-lightbulb"></span>
                                            Recommendation
                                        </div>
                                        <div>${vuln.recommendation}</div>
                                    </div>
                                `;
                            }

                            // Create explanation section if available and enabled
                            let explanationHtml = '';
                            if (state.settings.showExplanations && vuln.explanation) {
                                explanationHtml = `
                                    <div class="explanation-box">
                                        <div class="recommendation-heading">
                                            <span class="codicon codicon-info"></span>
                                            Why This Is An Issue
                                        </div>
                                        <div>${vuln.explanation}</div>
                                    </div>
                                `;
                            }

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
                                    ${explanationHtml}
                                    ${recommendationHtml}
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
                });

                // Add event listeners for focus buttons
                document.querySelectorAll('#vulnerability-list .focus-button').forEach(button => {
                    button.addEventListener('click', function (e) {
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
                    // Remove existing click listeners if any
                    header.removeEventListener('click', headerClickHandler);

                    // Initialize the collapsed state attribute
                    if (!header.hasAttribute('data-collapsed')) {
                        header.dataset.collapsed = "false";
                    }

                    // Add the click handler
                    header.addEventListener('click', headerClickHandler);
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

    // Define the header click handler as a separate function for clean removal
    function headerClickHandler(event) {
        toggleCategoryGroup(this);
    }

    /**
     * Renders the linter results in the UI
     * Groups linter issues by category and applies current filters
     */
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

                // First group by file path
                const fileGroups = {};

                filteredResults.forEach(result => {
                    const filePath = result.filePath || 'Unknown File';
                    if (!fileGroups[filePath]) {
                        fileGroups[filePath] = {};
                    }

                    // Then group by category within each file
                    const category = result.category || 'Miscellaneous';
                    if (!fileGroups[filePath][category]) {
                        fileGroups[filePath][category] = [];
                    }

                    fileGroups[filePath][category].push(result);
                });

                // Clear the list first
                linterList.innerHTML = '';

                // Now render the file groups
                Object.keys(fileGroups).sort().forEach(filePath => {
                    // Add file header
                    const fileHeader = document.createElement('div');
                    fileHeader.className = 'category-group-header';
                    fileHeader.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                    fileHeader.style.padding = '10px';
                    fileHeader.style.fontWeight = 'bold';
                    fileHeader.style.marginTop = '20px';

                    // Count linter issues in this file
                    let fileIssueCount = 0;
                    Object.values(fileGroups[filePath]).forEach(group => {
                        fileIssueCount += group.length;
                    });

                    fileHeader.innerHTML = `
                        <span>${filePath}</span>
                        <span class="count">${fileIssueCount}</span>
                    `;
                    linterList.appendChild(fileHeader);

                    // Sort categories alphabetically
                    const sortedCategories = Object.keys(fileGroups[filePath]).sort();

                    // Create category groups within each file
                    sortedCategories.forEach(category => {
                        const items = fileGroups[filePath][category];

                        // Create category subgroup header
                        const categoryHeader = document.createElement('div');
                        categoryHeader.className = 'category-group-header';
                        categoryHeader.style.paddingLeft = '24px'; // Indent for hierarchy
                        categoryHeader.innerHTML = `
                            <span>${category || 'Miscellaneous'}</span>
                            <span class="count">${items.length}</span>
                        `;
                        linterList.appendChild(categoryHeader);

                        // Add linter issues in this category
                        items.forEach(result => {
                            // ...existing code to render individual linter items...
                            const li = document.createElement('li');
                            const categoryClass = getCategoryClass(result.category);

                            li.className = `linter-item category-${categoryClass}`;
                            li.dataset.index = filteredResults.indexOf(result);
                            li.style.marginLeft = '24px'; // Indent items under the category

                            // ...rest of your existing linter item rendering code...
                            // Keep the existing code for creating and populating linter items

                            // ...existing linter item creation code...

                            // Create header element
                            const header = document.createElement('div');
                            header.className = 'vulnerability-header';
                            header.onclick = function () { toggleItemExpansion(this); };

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
                            locationSpan.textContent = `Line ${result.line}${result.column ? ', Col ' + result.column : ''}`;
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

                            // Add event handlers to buttons
                            focusButton.addEventListener('click', function (e) {
                                e.stopPropagation();
                                const index = parseInt(this.dataset.index, 10);
                                if (index >= 0 && index < filteredResults.length) {
                                    vscode.postMessage({
                                        command: 'focusOnLinterIssue',
                                        linterIssue: filteredResults[index]
                                    });
                                }
                            });

                            ignoreButton.addEventListener('click', function (e) {
                                e.stopPropagation();
                                const ruleId = this.dataset.ruleId;
                                if (ruleId) {
                                    vscode.postMessage({
                                        command: 'ignoreLinterRule',
                                        ruleId: ruleId
                                    });
                                }
                            });

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
                });

                // Add event listeners for file and category group headers
                document.querySelectorAll('.category-group-header').forEach(header => {
                    // Remove existing click listeners if any
                    header.removeEventListener('click', headerClickHandler);

                    // Initialize the collapsed state attribute
                    if (!header.hasAttribute('data-collapsed')) {
                        header.dataset.collapsed = "false";
                    }

                    // Add the click handler
                    header.addEventListener('click', headerClickHandler);
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

    /**
     * Updates category headers after items are added or removed
     * Recalculates counts and removes empty categories
     */
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

    /**
     * Updates the linter issue count in the tab badge
     * Shows "no results" message if all issues are filtered out
     */
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

    /**
     * Initializes the UI components and sets up event listeners
     * Applies saved state and renders the appropriate tab content
     */
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
            confidenceFilterSelect.addEventListener('change', function () {
                state.filters.confidence = this.value;
                renderVulnerabilityList();
                saveState();
            });
        }

        // Impact toggle event handlers
        impactToggles.forEach(toggle => {
            toggle.addEventListener('click', function () {
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
            toggle.addEventListener('click', function () {
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
            dismissButton.addEventListener('click', function () {
                console.log('Dismiss button clicked, sending message to extension');
                vscode.postMessage({ command: 'dismissHighlights' });
            });
        }

        // Initialize tab switching (only if tabs exist)
        tabButtons.forEach(tab => {
            // Skip if this is the linter tab and linting is disabled
            if (tab.dataset.tab === 'linter' && !state.settings.enableLinting) {
                return;
            }

            tab.addEventListener('click', () => {
                toggleTab(tab.dataset.tab);
            });
        });

        // Make toggle function available globally
        window.toggleItemExpansion = toggleItemExpansion;

        // Initial render based on active tab
        const activeTab = document.querySelector('.tab.active');
        if (activeTab?.dataset.tab === 'linter' && state.settings.enableLinting) {
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
