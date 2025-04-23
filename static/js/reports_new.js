async function fetchPresences() {
    try {
        const response = await fetch('/api/presencas', { credentials: 'include' });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao carregar presenças: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Erro em fetchPresences:', error.message);
        return [];
    }
}

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

function groupPresencesByTurmaDayShift(presences) {
    const grouped = {};

    presences.forEach(presence => {
        const key = `${presence.turma_id}_${presence.data_escaneamento}_${presence.turno_escola_viva}`;
        if (!grouped[key]) {
            grouped[key] = {
                turma_id: presence.turma_id,
                turma_nome: presence.turma_nome,
                faixa_etaria: presence.faixa_etaria,
                turno: presence.turno_escola_viva,
                dia: presence.data_escaneamento,
                hora: presence.hora_escaneamento,
                polo_nome: presence.polo_nome,
                alunos: []
            };
        }
        grouped[key].alunos.push(presence);
    });

    return Object.values(grouped);
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
    // Pegar a primeira palavra composta e formatar com a primeira letra maiúscula
    const match = name.match(/^[^0-9]+/i);
    const firstName = match ? match[0].trim() : name;
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

function renderPresences(presences) {
    const presencesSection = document.getElementById('presences-section');
    presencesSection.innerHTML = '';

    const groupedPresences = groupPresencesByTurmaDayShift(presences);

    groupedPresences.forEach(group => {
        const formattedTurmaName = formatTurmaName(group.turma_nome);
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow-md border-2 border-blue-300';
        card.innerHTML = `
            <div class="mb-2">
                <h3 class="text-lg font-semibold">${formattedTurmaName}</h3>
                <p class="text-sm text-gray-600">Etapas: ${group.faixa_etaria.join(' e ')}</p>
                <p class="text-sm text-gray-600">Turno: ${group.turno}</p>
                <p class="text-sm text-gray-600">Polo: ${group.polo_nome}</p>
                <p class="text-sm text-gray-600">Dia: ${group.dia}</p>
                <p class="text-sm text-gray-600">Hora: ${group.hora}</p>
            </div>
            <hr class="border-t border-gray-200 my-4">
            <div class="flex justify-end mt-4">
                <button class="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">Visualizar</button>
            </div>
        `;
        presencesSection.appendChild(card);
    });
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
    const presences = await fetchPresences();
    renderPresences(presences);

    const occurrences = await fetchOccurrences();
    renderOccurrences(occurrences);
});