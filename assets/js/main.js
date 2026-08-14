// Search and Filter Functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const guideCards = document.querySelectorAll('.guide-card');
    const noResults = document.getElementById('no-results');
    const foodiesSearchInput = document.getElementById('foodies-search');
    const foodieRows = document.querySelectorAll('.foodies-page .person-row');
    const foodiesNoResults = document.getElementById('foodies-no-results');
    const foodiesHeroTitle = document.querySelector('.foodies-hero-title');
    const foodiesHeroDescription = document.querySelector('.foodies-hero-description');
    const defaultFoodiesHeroDescription = foodiesHeroDescription?.textContent || '';

    let currentArticleType = 'all';
    let currentSearchTerm = '';

    const heroAction = document.querySelector('.hero-action');
    const heroWords = ['Eat', 'Find', 'Make'];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let heroWordIndex = 0;

    if (heroAction && !prefersReducedMotion) {
        const displayDuration = 3000;
        const transitionDuration = 500;

        const rotateHeroWord = () => {
            heroAction.classList.add('is-changing');

            window.setTimeout(() => {
                heroWordIndex = (heroWordIndex + 1) % heroWords.length;
                heroAction.textContent = heroWords[heroWordIndex];
            }, transitionDuration / 2);

            window.setTimeout(() => {
                heroAction.classList.remove('is-changing');
                window.setTimeout(rotateHeroWord, displayDuration);
            }, transitionDuration);
        };

        window.setTimeout(rotateHeroWord, displayDuration);
    }


    // Filter by article type
    if (filterButtons) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Update active state
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                // Get selected article type
                currentArticleType = this.dataset.articleType;

                // Apply filters
                applyFilters();
            });
        });
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentSearchTerm = this.value.toLowerCase();
            applyFilters();
        });
    }

    if (foodiesSearchInput) {
        const foodiesUrlSearchTerm = getFoodiesUrlSearchTerm();
        if (foodiesUrlSearchTerm) {
            const safeFoodiesUrlSearchTerm = sanitizeFoodiesSearchTerm(foodiesUrlSearchTerm);
            foodiesSearchInput.value = safeFoodiesUrlSearchTerm;
            filterFoodies(safeFoodiesUrlSearchTerm, {
                updateUrl: safeFoodiesUrlSearchTerm !== foodiesUrlSearchTerm
            });
        }

        ['input', 'keyup', 'search', 'change'].forEach(eventName => {
            foodiesSearchInput.addEventListener(eventName, function() {
                const safeSearchTerm = sanitizeFoodiesSearchTerm(this.value);
                if (safeSearchTerm !== this.value) {
                    this.value = safeSearchTerm;
                }
                filterFoodies(safeSearchTerm);
            });
        });
    }

    // Apply all active filters
    function applyFilters() {
        let visibleCount = 0;

        guideCards.forEach(card => {
            const articleType = card.dataset.articleType;
            const title = card.dataset.title;
            const description = card.dataset.description;
            const tags = card.dataset.tags.toLowerCase();

            // Check article type filter
            const matchesArticleType = currentArticleType === 'all' || articleType === currentArticleType;

            // Check search filter
            const matchesSearch = currentSearchTerm === '' ||
                                title.includes(currentSearchTerm) ||
                                description.includes(currentSearchTerm) ||
                                tags.includes(currentSearchTerm);

            // Show or hide card
            if (matchesArticleType && matchesSearch) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        // Show/hide no results message
        if (noResults) {
            noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    function getUrlSearchParam(paramName) {
        return new URLSearchParams(window.location.search).get(paramName) || '';
    }

    function getFoodiesUrlSearchTerm() {
        return getUrlSearchParam('foodies') || getUrlSearchParam('foodie');
    }

    function sanitizeFoodiesSearchTerm(searchTerm) {
        return searchTerm
            .replace(/[<>"'`=\\]/g, '')
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .slice(0, 80);
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function matchesFoodiesSearch(searchableText, searchTerm) {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        if (!normalizedSearchTerm) {
            return true;
        }

        const boundedTerm = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(normalizedSearchTerm)}($|[^\\p{L}\\p{N}])`, 'u');
        return boundedTerm.test(searchableText.toLowerCase());
    }

    function rowHasMatchingFoodiesTag(row, searchTerm) {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        if (!normalizedSearchTerm) {
            return true;
        }

        return Array.from(row.querySelectorAll('.tag')).some(tag => {
            return tag.textContent.trim().toLowerCase() === normalizedSearchTerm;
        });
    }

    function getMatchingFoodiesTag(searchTerm) {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        if (!normalizedSearchTerm) {
            return '';
        }

        const tags = document.querySelectorAll('.foodies-page .tag');
        for (const tag of tags) {
            const tagText = tag.textContent.trim();
            if (tagText.toLowerCase() === normalizedSearchTerm) {
                return tagText;
            }
        }

        return '';
    }

    function updateFoodiesHero(searchTerm) {
        if (!foodiesHeroTitle && !foodiesHeroDescription) {
            return;
        }

        const matchingTag = getMatchingFoodiesTag(searchTerm);

        if (foodiesHeroTitle) {
            foodiesHeroTitle.textContent = matchingTag ? `${matchingTag} Foodies` : 'Foodies';
        }

        if (foodiesHeroDescription) {
            foodiesHeroDescription.textContent = matchingTag
                ? defaultFoodiesHeroDescription.replace('U.S.', matchingTag)
                : defaultFoodiesHeroDescription;
        }
    }

    function updateFoodiesSearchUrl(searchTerm) {
        const url = new URL(window.location.href);
        const normalizedSearchTerm = sanitizeFoodiesSearchTerm(searchTerm).trim();

        if (normalizedSearchTerm) {
            url.searchParams.set('foodies', normalizedSearchTerm);
        } else {
            url.searchParams.delete('foodies');
        }
        url.searchParams.delete('foodie');

        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    function filterFoodies(searchTerm, options = {}) {
        const shouldUpdateUrl = options.updateUrl !== false;
        const safeSearchTerm = sanitizeFoodiesSearchTerm(searchTerm);
        const normalizedSearchTerm = safeSearchTerm.trim().toLowerCase();
        let visibleCount = 0;

        foodieRows.forEach(row => {
            const identity = row.querySelector('.identity')?.textContent || '';
            const bio = row.querySelector('.bio')?.textContent || '';
            const tags = row.querySelector('.tags')?.textContent || '';
            const searchableText = `${identity} ${bio} ${tags}`;
            const matchesSearch = rowHasMatchingFoodiesTag(row, normalizedSearchTerm) ||
                matchesFoodiesSearch(searchableText, normalizedSearchTerm);

            row.style.display = matchesSearch ? '' : 'none';
            if (matchesSearch) {
                visibleCount++;
            }
        });

        if (foodiesNoResults) {
            foodiesNoResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }

        updateFoodiesHero(safeSearchTerm);

        if (shouldUpdateUrl) {
            updateFoodiesSearchUrl(safeSearchTerm);
        }
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
