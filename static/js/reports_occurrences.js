let occurrences = [];

// Função de retentativa para requisições
const retryFetch = async (url, options, retries = 2, delay = 500) => {
    const cacheKey = `cache_${url}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 10000 && data && Array.isArray(data)) {
                return data;
            } else {
                localStorage.removeItem(cacheKey);
            }
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
    }

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`Erro HTTP! Status: ${response.status}`);
            }
            const data = await response.json();
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
            } catch (e) {}
            return data;
        } catch (error) {
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
};

async function fetchData() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    overlay.innerHTML = '<div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>';
    document.body.appendChild(overlay);

    const mainContent = document.querySelector('.space-y-8');
    if (mainContent) {
        mainContent.classList.add('pointer-events-none');
    }

    try {
        occurrences = [];

        let isRendered = false;

        const cacheKey = 'cache_/api/ocorrencias';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < 10000 && data && Array.isArray(data)) {
                    occurrences = data;
                    isRendered = true;
                    renderOccurrences(occurrences);
                } else {
                    localStorage.removeItem(cacheKey);
                }
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }

        const data = await retryFetch('/api/ocorrencias', { credentials: 'include' });

        occurrences = Array.isArray(data) ? data : [];

        if (!isRendered || occurrences.length > 0) {
            renderOccurrences(occurrences);
        }

        if (overlay && mainContent) {
            overlay.remove();
            mainContent.classList.remove('pointer-events-none');
        }
    } catch (error) {
        showToast('Erro ao carregar dados: ' + error.message, 'error', 'alert-circle');
        renderOccurrences(occurrences);
        if (overlay && mainContent) {
            overlay.remove();
            mainContent.classList.remove('pointer-events-none');
        }
    }
}

function showToast(message, type, icon) {
    const toastContainer = document.getElementById('custom-toast-container');
    if (!toastContainer) {
        return;
    }

    const toastDiv = document.createElement('div');
    toastDiv.className = `custom-toast custom-toast-${type}`;
    toastDiv.innerHTML = `
        <i data-lucide="${icon}" class="custom-toast-icon h-3 w-3"></i>
        <span class="custom-toast-message">${message}</span>
        <button class="custom-toast-close">×</button>
    `;

    toastContainer.appendChild(toastDiv);

    lucide.createIcons();

    const timeout = setTimeout(() => {
        toastDiv.remove();
    }, 3000);

    const closeButton = toastDiv.querySelector('.custom-toast-close');
    closeButton.addEventListener('click', () => {
        clearTimeout(timeout);
        toastDiv.remove();
    });
}

function groupOccurrencesByTurmaDate(occurrences) {
    const grouped = {};

    occurrences.forEach(occurrence => {
        const key = `${occurrence.turma_id}_${occurrence.data_escaneamento}`;
        if (!grouped[key]) {
            grouped[key] = {
                turma_id: occurrence.turma_id,
                turma_nome: occurrence.turma_nome,
                faixa_etaria: occurrence.faixa_etaria,
                turno: occurrence.turno,
                data: occurrence.data_escaneamento,
                polo_nome: occurrence.polo_nome,
                ocorrencias: []
            };
        }
        grouped[key].ocorrencias.push(occurrence.ocorrencia);
    });

    return Object.values(grouped);
}

function formatTurmaName(name) {
    const match = name.match(/^[^0-9]+/i);
    const firstName = match ? match[0].trim() : name;
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

function renderOccurrences(occurrences) {
    const occurrencesSection = document.getElementById('occurrences-section');
    occurrencesSection.innerHTML = '';

    const groupedOccurrences = groupOccurrencesByTurmaDate(occurrences);

    groupedOccurrences.forEach(group => {
        const formattedTurmaName = formatTurmaName(group.turma_nome);
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow-md border-2 border-blue-300 transition-all duration-300 hover:bg-blue-50 hover:shadow-xl';
        card.innerHTML = `
            <div class="mb-2">
                <h3 class="text-lg font-semibold">${formattedTurmaName}</h3>
                <p class="text-sm text-gray-600">Etapas: ${group.faixa_etaria.join(' e ')}</p>
                <p class="text-sm text-gray-600">Turno: ${group.turno}</p>
                <p class="text-sm text-gray-600">Polo: ${group.polo_nome}</p>
                <p class="text-sm text-gray-600">Data: ${group.data}</p>
                <div class="mt-2">
                    ${group.ocorrencias.map(ocorrencia => `<p class="text-sm text-gray-800">${ocorrencia}</p>`).join('')}
                </div>
            </div>
        `;
        occurrencesSection.appendChild(card);
    });

    if (groupedOccurrences.length === 0) {
        occurrencesSection.innerHTML = '<div class="text-center py-4 text-gray-500 col-span-full">Nenhuma ocorrência registrada.</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
});