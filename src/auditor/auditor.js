// ===== Endereços dos contratos =====
// Endereços dos contratos na rede para interação com os smart contracts
const ABUNDANCE_TOKEN_ADDRESS = "0x1f981d16990fbee674d04953b4dadd5460b45c41";
const ATK_MANAGER_ADDRESS = "0xbc0ed91cebd0b1cc89972f5d41f3de635d575c92";
const TCO2_TOKEN_ADDRESS = "0x65a1fec1bf8efc19ba9f3ada5c41fa20640f3488";
const TCO2_MANAGER_ADDRESS = "0x0c1fa197e8637151bb3e63d4c95b098b1129b6dc";

const DECIMALS = 18; // Padrão para tokens ERC20

// ===== ABIs =====
// Interfaces mínimas dos contratos para leitura e interação
const ABUNDANCE_TOKEN_ABI = [
  "function totalSupply() view returns (uint256)"
];

const ATK_MANAGER_ABI = [
  "function requestCounter() view returns (uint256)",
  "function requests(uint256) view returns (uint256 batchNumber, uint256 amount, address requester, bool approved, bool processed, uint256 rejectionCode)",
  "function approveRequest(uint256)",
  "function rejectRequest(uint256, uint256)",
  "function getRequestsByBatch(uint256) view returns (uint256[], uint256[])"
];

// ===== Variáveis Globais =====
let provider, signer;
let abundanceToken, atkManager;
let selectedRequestId = null;
let selectedRequestData = null;

// ===== Conectar à carteira e instanciar contratos =====
async function conectarCarteira() {
  if (!window.ethereum) return alert("MetaMask não encontrada.");

  // Inicializa conexão com a carteira
  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();

  // Pega o endereço do usuário e exibe no cabeçalho
  const address = await signer.getAddress();
  document.getElementById("shortAddress").innerText = `${address.slice(0, 6)}...${address.slice(-4)}`;
  document.getElementById("copyAddress").setAttribute("data-address", address);

  // Instancia os contratos com signer para chamadas com permissão
  abundanceToken = new ethers.Contract(ABUNDANCE_TOKEN_ADDRESS, ABUNDANCE_TOKEN_ABI, signer);
  atkManager = new ethers.Contract(ATK_MANAGER_ADDRESS, ATK_MANAGER_ABI, signer);

  // Carrega dados iniciais do dashboard
  carregarDashboard();
}

// ===== Copiar endereço para clipboard =====
function copiarEndereco() {
  const fullAddress = document.getElementById("copyAddress").getAttribute("data-address");
  navigator.clipboard.writeText(fullAddress).then(() => alert("Endereço copiado!"));
}

// ===== Carrega estatísticas e requests para o dashboard =====
async function carregarDashboard() {
  const totalATK = await abundanceToken.totalSupply();
  const totalRequests = await atkManager.requestCounter();

  let aprovados = 0, rejeitados = 0, atkAprovados = 0;
  const pendingUl = document.getElementById("pendingRequests");
  const historyUl = document.getElementById("historyRequests");
  pendingUl.innerHTML = "";
  historyUl.innerHTML = "";

  // Loop por todas as requests criadas
  for (let i = 1; i <= totalRequests; i++) {
    const req = await atkManager.requests(i);
    const li = document.createElement("li");
    li.innerText = `Request ${i}`;

    // Se ainda não processada, entra na lista de pendentes
    if (!req.processed) {
      li.onclick = () => abrirModal(i, req);
      pendingUl.appendChild(li);
    } else {
      // Se processada, entra no histórico
      li.onclick = () => abrirModal(i, req);
      historyUl.appendChild(li);

      // Contabiliza estatísticas
      if (req.approved) {
        aprovados++;
        atkAprovados += parseFloat(ethers.utils.formatUnits(req.amount, DECIMALS));
      } else {
        rejeitados++;
      }
    }
  }

  // Calcula porcentagens
  const totalProcessadas = aprovados + rejeitados;
  const porcentAprov = totalProcessadas ? ((aprovados / totalProcessadas) * 100).toFixed(1) : 0;
  const porcentRej = totalProcessadas ? ((rejeitados / totalProcessadas) * 100).toFixed(1) : 0;

  // Exibe no dashboard
  document.getElementById("atkAprovados").innerText = `${atkAprovados.toFixed(2)} ATK`;
  document.getElementById("percentAprovados").innerText = `${porcentAprov}%`;
  document.getElementById("percentRejeitados").innerText = `${porcentRej}%`;
}

// ===== Abre o modal com detalhes da request selecionada =====
function abrirModal(id, req) {
  selectedRequestId = id;
  selectedRequestData = req;

  // Preenche os campos do modal
  document.getElementById("modalId").innerText = id;
  document.getElementById("modalQtd").innerText = ethers.utils.formatUnits(req.amount, DECIMALS);
  document.getElementById("modalLote").innerText = req.batchNumber;
  document.getElementById("modalRequester").innerText = req.requester;
  document.getElementById("modalStatus").innerText = req.approved
    ? "Aprovada"
    : req.processed
    ? "Rejeitada"
    : "Pendente";

  // Mostra ou oculta os botões dependendo do status
  const actions = document.getElementById("modalActions");
  actions.style.display = !req.processed ? "flex" : "none";

  // Exibe o modal
  const modal = document.getElementById("modalRequest");
  modal.classList.remove("hidden");
  modal.classList.add("show");
}

// ===== Fecha o modal e reseta os dados =====
function fecharModal() {
  selectedRequestId = null;
  selectedRequestData = null;

  const modal = document.getElementById("modalRequest");
  modal.classList.remove("show");
  modal.classList.add("hidden");

  // Limpa os campos do modal
  document.getElementById("modalId").innerText = "";
  document.getElementById("modalQtd").innerText = "";
  document.getElementById("modalLote").innerText = "";
  document.getElementById("modalRequester").innerText = "";
  document.getElementById("modalStatus").innerText = "";
  document.getElementById("modalRejectionCode").innerText = "";
}

// ===== Aprova uma request no contrato =====
async function confirmarAprovacao() {
  try {
    const tx = await atkManager.approveRequest(selectedRequestId);
    await tx.wait(); // Aguarda a confirmação do bloco
    fecharModal();
    carregarDashboard(); // Atualiza a interface
  } catch (err) {
    alert("Feito"); // Mensagem genérica (pode ser melhorada)
    console.error(err);
  }
}

// ===== Rejeita uma request no contrato =====
async function confirmarRejeicao() {
  try {
    // Envia código de rejeição 0 apenas como placeholder
    const tx = await atkManager.rejectRequest(selectedRequestId, 0);
    await tx.wait();
    fecharModal();
    carregarDashboard();
  } catch (err) {
    alert("Feito"); // Mensagem genérica (pode ser mais específica)
    console.error(err);
  }
}

// ===== Busca requests por número de lote =====
async function buscarPorLote() {
  const lote = document.getElementById("loteBusca").value;
  if (!lote) return;

  const resUL = document.getElementById("resultadoBusca");
  resUL.innerHTML = "Buscando...";

  try {
    // Busca todas as requests associadas ao lote
    const [ids, amounts] = await atkManager.getRequestsByBatch(lote);
    resUL.innerHTML = "";

    // Exibe os resultados
    ids.forEach((id, i) => {
      const li = document.createElement("li");
      li.innerText = `Request #${id} - ${ethers.utils.formatUnits(amounts[i], DECIMALS)} ATK`;
      resUL.appendChild(li);
    });
  } catch (err) {
    resUL.innerHTML = "Erro ao buscar.";
    console.error(err);
  }
}

// ===== Inicializa a aplicação ao carregar a página =====
window.onload = conectarCarteira;
