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
    const match = name.match(/^[^0-9]+/i);
    const firstName = match ? match[0].trim() : name;
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

function formatDateToBrazilian(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
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
            <div class="flex justify-end mt-4 space-x-2">
                <button class="view-students-btn bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">Visualizar</button>
                <div class="dropdown-container">
                    <button class="print-btn">Imprimir</button>
                    <div class="dropdown-menu">
                        <a href="#" class="print-excel">Excel</a>
                        <a href="#" class="print-pdf">PDF</a>
                    </div>
                </div>
            </div>
        `;

        // Adicionar evento de clique ao botão "Visualizar"
        card.querySelector('.view-students-btn').addEventListener('click', () => {
            openViewStudentsModal(group);
        });

        // Adicionar evento de clique ao botão "Imprimir" para mostrar/esconder o dropdown
        const printBtn = card.querySelector('.print-btn');
        const dropdownMenu = card.querySelector('.dropdown-menu');
        printBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede que o clique no botão feche o dropdown imediatamente
            dropdownMenu.classList.toggle('show');
        });

        // Fechar o dropdown ao clicar fora dele
        document.addEventListener('click', (e) => {
            if (!printBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });

        // Adicionar eventos para as opções de impressão
        card.querySelector('.print-excel').addEventListener('click', (e) => {
            e.preventDefault();
            generateExcel(group);
            dropdownMenu.classList.remove('show');
        });

        card.querySelector('.print-pdf').addEventListener('click', (e) => {
            e.preventDefault();
            generatePDF(group);
            dropdownMenu.classList.remove('show');
        });

        presencesSection.appendChild(card);
    });
}

function openViewStudentsModal(group) {
    const modal = document.getElementById('view-students-modal');
    const modalDate = document.getElementById('modal-date');
    const modalDetails = document.getElementById('modal-details');
    const studentsList = document.getElementById('students-list');
    const occurrencesList = document.getElementById('occurrences-list');
    const closeModalBtn = document.getElementById('close-modal');

    // Preencher o cabeçalho do modal
    const formattedTurmaName = formatTurmaName(group.turma_nome);

    // Formatar a data para o padrão brasileiro (dd/mm/aaaa)
    const formattedDate = formatDateToBrazilian(group.dia);
    modalDate.textContent = `Presença do dia: ${formattedDate}`;

    // Preencher o título da turma e os detalhes dentro da div details-box
    modalDetails.innerHTML = `
        <h3 class="text-lg font-semibold mb-2">${formattedTurmaName}</h3>
        Etapas: ${group.faixa_etaria.join(' e ')} | 
        Turno: ${group.turno} | 
        Polo: ${group.polo_nome} | 
        Dia: ${group.dia} | 
        Hora: ${group.hora}
    `;

    // Agrupar alunos por id_aluno para contabilizar presenças
    const groupedStudents = {};

    group.alunos.forEach(student => {
        const studentId = student.id_aluno;
        if (!groupedStudents[studentId]) {
            groupedStudents[studentId] = {
                nome_aluno: student.nome_aluno,
                unidade: student.unidade,
                presencas: []
            };
        }
        groupedStudents[studentId].presencas.push(student.presenca);
    });

    // Preencher a lista de alunos com nome, unidade e emoji em colunas fixas
    studentsList.innerHTML = '';
    Object.values(groupedStudents).forEach(student => {
        const studentItem = document.createElement('div');
        studentItem.className = 'border-b border-gray-200 py-2 flex items-center';

        // Determinar o estado de presença e o emoji correspondente
        let emoji = '';
        const hasCheckin = student.presencas.includes('checkin');
        const hasCheckout = student.presencas.includes('checkout');
        const isAbsent = student.presencas.includes('ausente');

        if (hasCheckin || hasCheckout) {
            emoji = '✅'; // Emoji de verificação para presente (checkin, checkout ou ambos)
        } else if (isAbsent) {
            emoji = '❌'; // Emoji de negação para ausente
        }

        studentItem.innerHTML = `
            <div class="flex w-full">
                <span style="width: 400px;">${student.nome_aluno}</span>
                <span style="width: 300px;">${student.unidade}</span>
                <span style="width: 50px; text-align: right;">${emoji}</span>
            </div>
        `;
        studentsList.appendChild(studentItem);
    });

    // Preencher a seção de ocorrências
    const groupedOccurrences = groupOccurrencesByTurmaDate(window.occurrences || []);
    const matchingOccurrences = groupedOccurrences.find(oc => 
        oc.turma_id === group.turma_id && oc.data === group.dia
    );

    occurrencesList.innerHTML = '';
    if (matchingOccurrences && matchingOccurrences.ocorrencias.length > 0) {
        matchingOccurrences.ocorrencias.forEach(ocorrencia => {
            const occurrenceItem = document.createElement('p');
            occurrenceItem.textContent = ocorrencia;
            occurrencesList.appendChild(occurrenceItem);
        });
    } else {
        const placeholder = document.createElement('p');
        placeholder.textContent = 'Sem registros de ocorrências';
        occurrencesList.appendChild(placeholder);
    }

    // Mostrar o modal adicionando a classe active
    modal.classList.add('active');

    // Adicionar evento de fechar o modal
    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Fechar o modal ao clicar fora dele
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// Função para gerar arquivo Excel
function generateExcel(group) {
    const formattedTurmaName = formatTurmaName(group.turma_nome);
    const formattedDate = formatDateToBrazilian(group.dia);

    // Preparar os dados para o Excel
    const data = [
        ["Presença do dia:", formattedDate],
        ["Turma:", formattedTurmaName],
        ["Etapas:", group.faixa_etaria.join(' e '), "Turno:", group.turno, "Polo:", group.polo_nome, "Dia:", group.dia, "Hora:", group.hora],
        [], // Linha em branco
        ["Nome", "Unidade", "Presença"]
    ];

    // Adicionar os dados dos alunos
    const groupedStudents = {};

    group.alunos.forEach(student => {
        const studentId = student.id_aluno;
        if (!groupedStudents[studentId]) {
            groupedStudents[studentId] = {
                nome_aluno: student.nome_aluno,
                unidade: student.unidade,
                presencas: []
            };
        }
        groupedStudents[studentId].presencas.push(student.presenca);
    });

    Object.values(groupedStudents).forEach(student => {
        let status = '';
        const hasCheckin = student.presencas.includes('checkin');
        const hasCheckout = student.presencas.includes('checkout');
        const isAbsent = student.presencas.includes('ausente');

        if (hasCheckin || hasCheckout) {
            status = 'Presente';
        } else if (isAbsent) {
            status = 'Ausente';
        }

        data.push([student.nome_aluno, student.unidade, status]);
    });

    // Adicionar as ocorrências
    const groupedOccurrences = groupOccurrencesByTurmaDate(window.occurrences || []);
    const matchingOccurrences = groupedOccurrences.find(oc => 
        oc.turma_id === group.turma_id && oc.data === group.dia
    );

    data.push([], ["Ocorrências:"]); // Linha em branco e título
    if (matchingOccurrences && matchingOccurrences.ocorrencias.length > 0) {
        matchingOccurrences.ocorrencias.forEach(ocorrencia => {
            data.push([ocorrencia]);
        });
    } else {
        data.push(["Sem registros de ocorrências"]);
    }

    // Criar uma planilha
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presenças");

    // Gerar e baixar o arquivo Excel
    XLSX.writeFile(wb, `Presencas_${formattedTurmaName}_${formattedDate}.xlsx`);
}

// Função para gerar arquivo PDF
function generatePDF(group) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const formattedTurmaName = formatTurmaName(group.turma_nome);
    const formattedDate = formatDateToBrazilian(group.dia);

    // Adicionar título e detalhes
    doc.setFontSize(16);
    doc.text(`Presença do dia: ${formattedDate}`, 14, 20);
    doc.setFontSize(14);
    doc.text(`Turma: ${formattedTurmaName}`, 14, 30);
    doc.setFontSize(12);
    doc.text(`Etapas: ${group.faixa_etaria.join(' e ')} | Turno: ${group.turno} | Polo: ${group.polo_nome} | Dia: ${group.dia} | Hora: ${group.hora}`, 14, 40);

    // Preparar os dados para a tabela de alunos
    const tableData = [];
    const groupedStudents = {};

    group.alunos.forEach(student => {
        const studentId = student.id_aluno;
        if (!groupedStudents[studentId]) {
            groupedStudents[studentId] = {
                nome_aluno: student.nome_aluno,
                unidade: student.unidade,
                presencas: []
            };
        }
        groupedStudents[studentId].presencas.push(student.presenca);
    });

    Object.values(groupedStudents).forEach(student => {
        let status = '';
        const hasCheckin = student.presencas.includes('checkin');
        const hasCheckout = student.presencas.includes('checkout');
        const isAbsent = student.presencas.includes('ausente');

        if (hasCheckin || hasCheckout) {
            status = 'Presente';
        } else if (isAbsent) {
            status = 'Ausente';
        }

        tableData.push([student.nome_aluno, student.unidade, status]);
    });

    // Gerar a tabela de alunos no PDF
    doc.autoTable({
        startY: 50,
        head: [['Nome', 'Unidade', 'Presença']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [147, 197, 253] }, // Cor azul clara (#93c5fd)
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 80 },
            2: { cellWidth: 20 }
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
                const cellText = data.cell.text[0];
                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellWidth = data.cell.width;
                const cellHeight = data.cell.height;

                // Limpar o texto original para evitar sobreposição
                doc.setFillColor(255, 255, 255);
                doc.rect(cellX, cellY, cellWidth, cellHeight, 'F');

                // Definir a cor e o estilo do texto
                if (cellText === 'Presente') {
                    doc.setTextColor(0, 100, 0); // Verde escuro
                    doc.setFont("helvetica", "bold");
                } else if (cellText === 'Ausente') {
                    doc.setTextColor(204, 85, 0); // Laranja escuro
                    doc.setFont("helvetica", "bold");
                }

                // Centralizar o texto na célula
                const textWidth = doc.getTextWidth(cellText);
                const textX = cellX + (cellWidth - textWidth) / 2;
                const textY = cellY + (cellHeight / 2) + 1; // Ajuste vertical
                doc.text(cellText, textX, textY);

                // Resetar a cor do texto para o próximo uso
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "normal");
            }
        }
    });

    // Adicionar as ocorrências ao PDF
    const groupedOccurrences = groupOccurrencesByTurmaDate(window.occurrences || []);
    const matchingOccurrences = groupedOccurrences.find(oc => 
        oc.turma_id === group.turma_id && oc.data === group.dia
    );

    let finalY = doc.lastAutoTable.finalY || 50; // Pegar a posição Y após a tabela
    finalY += 10; // Espaço após a tabela

    doc.setFontSize(14);
    doc.text("Ocorrências:", 14, finalY);
    finalY += 6; // Espaço após o título

    doc.setFontSize(12);
    if (matchingOccurrences && matchingOccurrences.ocorrencias.length > 0) {
        matchingOccurrences.ocorrencias.forEach((ocorrencia, index) => {
            doc.text(`${index + 1}. ${ocorrencia}`, 14, finalY);
            finalY += 6; // Espaço entre ocorrências
        });
    } else {
        doc.text("Sem registros de ocorrências", 14, finalY);
    }

    // Baixar o PDF
    doc.save(`Presencas_${formattedTurmaName}_${formattedDate}.pdf`);
}

document.addEventListener('DOMContentLoaded', async () => {
    const presences = await fetchPresences();
    renderPresences(presences);

    // Armazenar as ocorrências globalmente para uso posterior
    window.occurrences = await fetchOccurrences();
});