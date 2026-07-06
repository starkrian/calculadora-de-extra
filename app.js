const VALORES = {
    HE: {
        diurno: { bruto: 33.35, liquido: 24.18 },
        noturno: { bruto: 50.03, liquido: 36.27 }
    },
    VD: {
        diurno: { bruto: 26.72, liquido: 26.72 },
        noturno: { bruto: 32.29, liquido: 32.29 }
    }
};

let agenda = JSON.parse(localStorage.getItem('agendaServicos')) || [];

// TEMA ESCURO
const btnTema = document.getElementById('btnTema');
const metaThemeColor = document.getElementById('theme-color-meta');

function aplicarTema(tema) {
    if (tema === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        btnTema.textContent = '☀️ Tema Claro';
        metaThemeColor.setAttribute('content', '#0b1120');
    } else {
        document.documentElement.removeAttribute('data-theme');
        btnTema.textContent = '🌙 Tema Escuro';
        metaThemeColor.setAttribute('content', '#1e40af');
    }
}

const temaSalvo = localStorage.getItem('tema');
if (temaSalvo) aplicarTema(temaSalvo);

btnTema.addEventListener('click', () => {
    const temaAtual = document.documentElement.getAttribute('data-theme');
    const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
    aplicarTema(novoTema);
    localStorage.setItem('tema', novoTema);
});

// FORMATAÇÃO E CÁLCULOS
function formatarDinheiro(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataString) {
    const partes = dataString.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function configurarMesInicial() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    document.getElementById('mesFiltro').value = `${ano}-${mes}`;
}

function calcularServico(tipo, inicio, termino) {
    let baseDate = "2000-01-01T";
    let horaInicio = new Date(baseDate + inicio + ":00");
    let horaTermino = new Date(baseDate + termino + ":00");

    if (horaTermino < horaInicio) {
        horaTermino.setDate(horaTermino.getDate() + 1);
    }

    let minDiurnos = 0;
    let minNoturnos = 0;
    let atual = new Date(horaInicio);

    while (atual < horaTermino) {
        let h = atual.getHours();
        if (h >= 22 || h < 5) {
            minNoturnos++;
        } else {
            minDiurnos++;
        }
        atual.setMinutes(atual.getMinutes() + 1);
    }

    const horasDiurnas = minDiurnos / 60;
    const horasNoturnas = minNoturnos / 60;
    const tabela = VALORES[tipo];

    const totalBruto = (horasDiurnas * tabela.diurno.bruto) + (horasNoturnas * tabela.noturno.bruto);
    const totalLiquido = (horasDiurnas * tabela.diurno.liquido) + (horasNoturnas * tabela.noturno.liquido);

    return { horasDiurnas, horasNoturnas, totalBruto, totalLiquido };
}

// ATUALIZAR TELA
function atualizarTela() {
    const lista = document.getElementById('listaServicos');
    lista.innerHTML = '';

    const mesSelecionado = document.getElementById('mesFiltro').value;
    let brutoRealizado = 0, liquidoRealizado = 0, brutoPrevisto = 0, liquidoPrevisto = 0;

    let hoje = new Date();
    hoje.setHours(0,0,0,0);

    const agendaFiltrada = agenda.filter(item => item.data.startsWith(mesSelecionado));
    agendaFiltrada.sort((a, b) => new Date(a.data) - new Date(b.data));

    agendaFiltrada.forEach(item => {
        let dataItem = new Date(item.data + "T00:00:00");
        
        if (dataItem <= hoje) {
            brutoRealizado += item.calculo.totalBruto;
            liquidoRealizado += item.calculo.totalLiquido;
        } else {
            brutoPrevisto += item.calculo.totalBruto;
            liquidoPrevisto += item.calculo.totalLiquido;
        }

        const indexReal = agenda.indexOf(item);
        const nomeExibicao = item.nomeServico ? item.nomeServico : "Serviço sem nome";

        lista.innerHTML += `
            <div class="servico-item">
                <span class="data-badge">${formatarData(item.data)}</span>
                <strong>${nomeExibicao}</strong> - ${item.tipo} (${item.inicio} às ${item.termino})<br>
                <small class="texto-pequeno">Horas Normais: ${item.calculo.horasDiurnas.toFixed(1)}h | Horas Noturnas: ${item.calculo.horasNoturnas.toFixed(1)}h</small>
                <div class="valores">Líquido: ${formatarDinheiro(item.calculo.totalLiquido)} <br> <span class="texto-pequeno">(Bruto: ${formatarDinheiro(item.calculo.totalBruto)})</span></div>
                
                <div class="acoes-item">
                    <button class="btn-editar" onclick="editarItem(${indexReal})">✏️ Editar</button>
                    <button class="btn-excluir" onclick="excluirItem(${indexReal})">🗑️ Excluir</button>
                </div>
            </div>
        `;
    });

    if (agendaFiltrada.length === 0) {
        lista.innerHTML = '<p style="text-align:center;" class="texto-pequeno">Nenhum serviço agendado para este mês.</p>';
    }

    document.getElementById('totalRealizado').textContent = formatarDinheiro(liquidoRealizado);
    document.getElementById('brutoRealizado').textContent = formatarDinheiro(brutoRealizado);
    document.getElementById('totalPrevisto').textContent = formatarDinheiro(liquidoPrevisto);
    document.getElementById('brutoPrevisto').textContent = formatarDinheiro(brutoPrevisto);
}

document.getElementById('mesFiltro').addEventListener('change', atualizarTela);

// AÇÕES DE FORMULÁRIO (SALVAR / EDITAR)
window.editarItem = function(index) {
    const item = agenda[index];
    
    document.getElementById('nomeServico').value = item.nomeServico || '';
    document.getElementById('tipo').value = item.tipo;
    document.getElementById('data').value = item.data;
    document.getElementById('inicio').value = item.inicio;
    document.getElementById('termino').value = item.termino;
    document.getElementById('editIndex').value = index;
    
    document.getElementById('tituloFormulario').textContent = "Editar Serviço";
    document.getElementById('btnSalvar').textContent = "Atualizar Serviço";
    document.getElementById('btnCancelarEdicao').classList.remove('hidden');
    document.getElementById('areaFormulario').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('btnCancelarEdicao').addEventListener('click', () => {
    document.getElementById('serviceForm').reset();
    document.getElementById('editIndex').value = "-1";
    document.getElementById('tituloFormulario').textContent = "Adicionar Serviço";
    document.getElementById('btnSalvar').textContent = "Salvar na Agenda";
    document.getElementById('btnCancelarEdicao').classList.add('hidden');
});

document.getElementById('serviceForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const nomeServico = document.getElementById('nomeServico').value;
    const tipo = document.getElementById('tipo').value;
    const data = document.getElementById('data').value;
    const inicio = document.getElementById('inicio').value;
    const termino = document.getElementById('termino').value;
    const editIndex = parseInt(document.getElementById('editIndex').value);

    const calculo = calcularServico(tipo, inicio, termino);
    const novoServico = { nomeServico, tipo, data, inicio, termino, calculo };
    
    if (editIndex > -1) {
        agenda[editIndex] = novoServico;
        document.getElementById('editIndex').value = "-1";
        document.getElementById('tituloFormulario').textContent = "Adicionar Serviço";
        document.getElementById('btnSalvar').textContent = "Salvar na Agenda";
        document.getElementById('btnCancelarEdicao').classList.add('hidden');
    } else {
        agenda.push(novoServico);
    }

    localStorage.setItem('agendaServicos', JSON.stringify(agenda));
    document.getElementById('mesFiltro').value = data.substring(0, 7);
    atualizarTela();
    this.reset();
});

// EXCLUIR E LIMPAR
window.excluirItem = function(index) {
    if(confirm("Deseja excluir este serviço?")) {
        agenda.splice(index, 1);
        localStorage.setItem('agendaServicos', JSON.stringify(agenda));
        atualizarTela();
    }
}

document.getElementById('btnLimpar').addEventListener('click', function() {
    if(confirm("Tem certeza que deseja apagar TODO o seu histórico permanentemente?")) {
        agenda = [];
        localStorage.removeItem('agendaServicos');
        atualizarTela();
    }
});

// EXPORTAR EXCEL
document.getElementById('btnExportar').addEventListener('click', function() {
    if (agenda.length === 0) return alert("A agenda está vazia.");

    const agendaExportar = [...agenda].sort((a, b) => new Date(a.data) - new Date(b.data));
    
    const cabecalho = ["Nome do Serviço", "Tipo", "Data", "Inicio", "Termino", "Horas Diurnas", "Horas Noturnas", "Valor Bruto", "Valor Liquido"];
    let csvRows = [cabecalho.join(";")];

    agendaExportar.forEach(item => {
        const linha = [
            item.nomeServico || "Sem nome",
            item.tipo, 
            formatarData(item.data), 
            item.inicio, 
            item.termino,
            item.calculo.horasDiurnas.toFixed(2).replace('.', ','),
            item.calculo.horasNoturnas.toFixed(2).replace('.', ','),
            item.calculo.totalBruto.toFixed(2).replace('.', ','),
            item.calculo.totalLiquido.toFixed(2).replace('.', ',')
        ];
        csvRows.push(linha.join(";"));
    });

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Relatorio_HE_VD.csv";
    link.click();
});

// INICIALIZAÇÃO E PWA
configurarMesInicial();
atualizarTela();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js');
    });
}