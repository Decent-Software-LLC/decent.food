// Search and Filter Functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const guideCards = document.querySelectorAll('.guide-card');
    const noResults = document.getElementById('no-results');
    const foodiesSearchInput = document.getElementById('foodies-search');
    const foodiesSearchClear = document.getElementById('foodies-search-clear');
    const foodiesSearchBox = document.querySelector('.foodies-search');
    const foodiesTagSuggestions = document.getElementById('foodies-tag-suggestions');
    const foodiesPage = document.querySelector('.foodies-page');
    const foodieRows = document.querySelectorAll('.foodies-page .person-row');
    const foodiesNoResults = document.getElementById('foodies-no-results');
    const foodiesCountHeading = document.getElementById('foodies-count-heading');
    const foodiesHeroTitle = document.querySelector('.foodies-hero-title');
    const foodiesHeroDescription = document.querySelector('.foodies-hero-description');
    const defaultFoodiesHeroDescription = foodiesHeroDescription?.textContent || '';
    const foodiesMetaDescription = document.querySelector('meta[name="description"]');
    const foodiesCanonicalLink = document.querySelector('link[rel="canonical"]');
    const foodiesOgTitle = document.querySelector('meta[property="og:title"]');
    const foodiesOgDescription = document.querySelector('meta[property="og:description"]');
    const foodiesOgUrl = document.querySelector('meta[property="og:url"]');
    const foodiesPageTag = foodiesPage?.dataset.foodieTag || '';
    const defaultDocumentTitle = document.title;
    const siteTitle = defaultDocumentTitle.includes(' | ')
        ? defaultDocumentTitle.split(' | ').pop()
        : 'decent.food';
    const defaultFoodiesCanonicalHref = foodiesCanonicalLink?.href || '';
    let foodiesTags = [];

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
        foodiesTags = getFoodiesTags();
        setupFoodiesTagFilters();
        updateFoodiesTagSuggestions('');

        const foodiesUrlSearchTerm = getFoodiesUrlSearchTerm();
        const initialFoodiesSearchTerm = foodiesUrlSearchTerm || foodiesPageTag;
        if (initialFoodiesSearchTerm) {
            const safeFoodiesUrlSearchTerm = sanitizeFoodiesSearchTerm(initialFoodiesSearchTerm);
            const initialTagUrl = !foodiesPageTag && foodiesUrlSearchTerm
                ? getFoodiesTagUrl(safeFoodiesUrlSearchTerm)
                : '';
            if (initialTagUrl) {
                window.location.replace(initialTagUrl);
                return;
            }

            foodiesSearchInput.value = safeFoodiesUrlSearchTerm;
            updateFoodiesTagSuggestions(safeFoodiesUrlSearchTerm);
            filterFoodies(safeFoodiesUrlSearchTerm, {
                updateUrl: Boolean(foodiesUrlSearchTerm) && safeFoodiesUrlSearchTerm !== foodiesUrlSearchTerm
            });
        }

        ['input', 'keyup', 'search'].forEach(eventName => {
            foodiesSearchInput.addEventListener(eventName, function() {
                const safeSearchTerm = sanitizeFoodiesSearchTerm(this.value);
                if (safeSearchTerm !== this.value) {
                    this.value = safeSearchTerm;
                }

                if (foodiesPageTag && !safeSearchTerm.trim()) {
                    window.location.href = '/food-influencers.html';
                    return;
                }

                updateFoodiesTagSuggestions(safeSearchTerm);
                filterFoodies(safeSearchTerm);
            });
        });

        foodiesSearchInput.addEventListener('change', function() {
            const safeSearchTerm = sanitizeFoodiesSearchTerm(this.value);
            if (safeSearchTerm !== this.value) {
                this.value = safeSearchTerm;
            }

            if (foodiesPageTag && !safeSearchTerm.trim()) {
                window.location.href = '/food-influencers.html';
                return;
            }

            const tagUrl = getFoodiesTagUrl(safeSearchTerm);
            if (tagUrl && window.location.pathname !== new URL(tagUrl, window.location.origin).pathname) {
                window.location.href = tagUrl;
                return;
            }

            updateFoodiesTagSuggestions(safeSearchTerm);
            filterFoodies(safeSearchTerm);
        });

        if (foodiesSearchClear) {
            foodiesSearchClear.addEventListener('click', function() {
                foodiesSearchInput.value = '';
                updateFoodiesTagSuggestions('');
                if (foodiesPageTag) {
                    window.location.href = '/food-influencers.html';
                    return;
                }

                filterFoodies('');
                foodiesSearchInput.focus();
            });
        }

        if (!initialFoodiesSearchTerm) {
            filterFoodies('', { updateUrl: false });
        }
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

        for (const tag of foodiesTags) {
            if (tag.toLowerCase() === normalizedSearchTerm) {
                return tag;
            }
        }

        return '';
    }

    function getFoodiesTagIndexItems() {
        const tagIndex = document.getElementById('foodies-tag-index');
        if (!tagIndex?.textContent) {
            return [];
        }

        try {
            return JSON.parse(tagIndex.textContent)
                .map(item => ({
                    tag: item.tag || '',
                    slug: item.slug || '',
                    url: item.url ? new URL(item.url, window.location.origin).href : ''
                }))
                .filter(item => item.tag && item.url);
        } catch {
            return [];
        }
    }

    function getFoodiesPageTags() {
        return Array.from(document.querySelectorAll('.foodies-page .tag'))
            .map(tag => tag.textContent.trim())
            .filter(Boolean);
    }

    function getFoodiesTagUrl(searchTerm) {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        if (!normalizedSearchTerm) {
            return '';
        }

        const match = getFoodiesTagIndexItems()
            .find(item => item.tag.toLowerCase() === normalizedSearchTerm);

        return match?.url || '';
    }

    function getFoodiesTags() {
        const indexedTags = getFoodiesTagIndexItems().map(item => item.tag);
        const pageTags = getFoodiesPageTags();

        return [...indexedTags, ...pageTags]
            .filter((tag, index, tags) => tags.findIndex(item => item.toLowerCase() === tag.toLowerCase()) === index)
            .sort((a, b) => a.localeCompare(b));
    }

    function updateFoodiesTagSuggestions(searchTerm) {
        if (!foodiesTagSuggestions) {
            return;
        }

        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        if (normalizedSearchTerm.length < 3) {
            foodiesTagSuggestions.replaceChildren();
            return;
        }

        const isExactTagMatch = foodiesTags.some(tag => tag.toLowerCase() === normalizedSearchTerm);
        if (isExactTagMatch) {
            foodiesTagSuggestions.replaceChildren();
            return;
        }

        const matchingTags = foodiesTags.filter(tag => tag.toLowerCase().includes(normalizedSearchTerm));

        foodiesTagSuggestions.replaceChildren(...matchingTags.map(tag => {
            const option = document.createElement('option');
            option.value = tag;
            return option;
        }));
    }

    function updateFoodiesSearchClear(searchTerm) {
        if (!foodiesSearchBox) {
            return;
        }

        foodiesSearchBox.classList.toggle('has-value', Boolean(searchTerm.trim()));
    }

    function filterFoodiesByTag(tag) {
        const safeTag = sanitizeFoodiesSearchTerm(tag).trim();
        if (!safeTag) {
            return;
        }

        foodiesSearchInput.value = safeTag;
        updateFoodiesTagSuggestions(safeTag);
        updateFoodiesSearchClear(safeTag);
        filterFoodies(safeTag);
        foodiesSearchInput.focus();
    }

    function setupFoodiesTagFilters() {
        if (!foodiesPage) {
            return;
        }

        foodiesPage.querySelectorAll('.tag').forEach(tag => {
            const tagText = tag.textContent.trim();
            if (tag instanceof HTMLAnchorElement) {
                tag.setAttribute('aria-label', `View ${tagText} foodies`);
                return;
            }

            tag.setAttribute('role', 'button');
            tag.setAttribute('tabindex', '0');
            tag.setAttribute('aria-label', `Filter foodies by ${tagText}`);
        });

        foodiesPage.addEventListener('click', event => {
            const target = event.target instanceof Element ? event.target : event.target?.parentElement;
            const tag = target?.closest('.tag');
            if (tag && foodiesPage.contains(tag)) {
                if (tag instanceof HTMLAnchorElement) {
                    return;
                }

                event.preventDefault();
                filterFoodiesByTag(tag.textContent);
            }
        });

        foodiesPage.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            const target = event.target instanceof Element ? event.target : event.target?.parentElement;
            const tag = target?.closest('.tag');
            if (tag && foodiesPage.contains(tag)) {
                if (tag instanceof HTMLAnchorElement) {
                    return;
                }

                event.preventDefault();
                filterFoodiesByTag(tag.textContent);
            }
        });
    }

    function toFoodiesTitleCase(value) {
        return value.replace(/\p{L}[\p{L}'’]*/gu, word => {
            if (word.length > 1 && word === word.toUpperCase()) {
                return word;
            }

            return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
        });
    }

    function updateFoodiesHero(searchTerm) {
        if (!foodiesHeroTitle && !foodiesHeroDescription) {
            return;
        }

        const matchingTag = getMatchingFoodiesTag(searchTerm);
        const displayTag = matchingTag ? toFoodiesTitleCase(matchingTag) : '';

        if (foodiesHeroTitle) {
            foodiesHeroTitle.textContent = displayTag ? `${displayTag} Foodies` : 'Foodies';
        }

        if (foodiesHeroDescription) {
            foodiesHeroDescription.textContent = displayTag
                ? defaultFoodiesHeroDescription.replace('U.S.', displayTag)
                : defaultFoodiesHeroDescription;
        }
    }

    function updateFoodiesCountHeading(visibleCount, searchTerm) {
        if (!foodiesCountHeading) {
            return;
        }

        const matchingTag = getMatchingFoodiesTag(searchTerm);
        const displayTerm = matchingTag
            ? toFoodiesTitleCase(matchingTag)
            : toFoodiesTitleCase(sanitizeFoodiesSearchTerm(searchTerm).trim());

        foodiesCountHeading.textContent = displayTerm
            ? `${visibleCount} ${displayTerm} Foodies found`
            : `${visibleCount} foodies found`;
    }

    function updateFoodiesMetadata() {
        const pageTitle = foodiesHeroTitle
            ? `${foodiesHeroTitle.textContent.trim()} | ${siteTitle}`
            : document.title;
        const pageDescription = foodiesCountHeading && foodiesHeroDescription
            ? `${foodiesCountHeading.textContent.trim()}. ${foodiesHeroDescription.textContent.trim()}`
            : foodiesMetaDescription?.getAttribute('content') || '';

        if (foodiesHeroTitle) {
            document.title = pageTitle;
        }

        if (foodiesMetaDescription && foodiesCountHeading && foodiesHeroDescription) {
            foodiesMetaDescription.setAttribute('content', pageDescription);
        }

        if (foodiesOgTitle) {
            foodiesOgTitle.setAttribute('content', pageTitle);
        }

        if (foodiesOgDescription && pageDescription) {
            foodiesOgDescription.setAttribute('content', pageDescription);
        }

        if (foodiesCanonicalLink) {
            const canonicalUrl = new URL(defaultFoodiesCanonicalHref || window.location.href);
            const matchingTag = getMatchingFoodiesTag(foodiesSearchInput?.value || '');
            const tagUrl = getFoodiesTagUrl(matchingTag);
            canonicalUrl.search = '';
            canonicalUrl.hash = '';

            if (tagUrl) {
                const staticTagUrl = new URL(tagUrl, window.location.origin);
                canonicalUrl.pathname = staticTagUrl.pathname;
                canonicalUrl.search = '';
            } else if (matchingTag && !foodiesPageTag) {
                canonicalUrl.searchParams.set('foodies', matchingTag);
            }

            foodiesCanonicalLink.href = canonicalUrl.toString();

            if (foodiesOgUrl) {
                foodiesOgUrl.setAttribute('content', canonicalUrl.toString());
            }
        }
    }

    function updateFoodiesSearchUrl(searchTerm) {
        const url = new URL(window.location.href);
        const normalizedSearchTerm = sanitizeFoodiesSearchTerm(searchTerm).trim();

        if (foodiesPageTag) {
            return;
        }

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

        updateFoodiesSearchClear(safeSearchTerm);
        updateFoodiesHero(safeSearchTerm);
        updateFoodiesCountHeading(visibleCount, safeSearchTerm);
        updateFoodiesMetadata();

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
