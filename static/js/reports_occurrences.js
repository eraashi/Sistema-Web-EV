async function fetchOccurrences() {
    try {
        const response = await fetch('/api/ocorrencias', { credentials: 'include' });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao carregar ocorrências: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Erro em fetchOccurrences:', error.message);
        return [];
    }
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
        card.className = 'bg-white p-4 rounded-lg shadow-md border-2 border-blue-300';
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
}

document.addEventListener('DOMContentLoaded', async () => {
    const occurrences = await fetchOccurrences();
    renderOccurrences(occurrences);
});