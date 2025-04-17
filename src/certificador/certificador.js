// ================== CONFIGURAÇÃO ==================
// Endereço do contrato TCO2Manager na blockchain
const TCO2_MANAGER_ADDRESS = "0x0c1fa197e8637151bb3e63d4c95b098b1129b6dc";
const DECIMALS = 18; // Padrão ERC20: número de casas decimais

// ABI com as funções necessárias do contrato TCO2Manager
const TCO2_MANAGER_ABI = [
  "function requestCounter() view returns (uint256)", // Total de requests já feitas
  "function requests(uint256) view returns (uint256 requestId, address client, uint256 atkAmount, uint256 tco2Amount, bool approved, bool processed, uint256 rejectionCode)",
  "function approveConversion(uint256 requestId) external", // Aprovar conversão
  "function rejectConversion(uint256 requestId, uint256 rejectionCode) external" // Rejeitar conversão
];

// ================== VARIÁVEIS GLOBAIS ==================
let provider, signer, userAddress;
let tco2Manager;
let selectedRequestId = null; // ID da request atualmente selecionada (usada no modal)

// ================== INICIALIZAÇÃO ==================
// Ao carregar a página, conecta a carteira e carrega as requests
window.onload = async () => {
  await conectarCarteira();
  await carregarRequests();
};

// ================== CONECTAR CARTEIRA ==================
// Conecta a carteira do usuário via MetaMask e instancia o contrato
async function conectarCarteira() {
  if (!window.ethereum) return alert("Instale o MetaMask.");

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  userAddress = await signer.getAddress();

  // Exibe o endereço abreviado e o armazena no botão para cópia
  document.getElementById("shortAddress").innerText = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
  document.getElementById("copyAddress").setAttribute("data-address", userAddress);

  // Cria instância do contrato TCO2Manager com signer
  tco2Manager = new ethers.Contract(TCO2_MANAGER_ADDRESS, TCO2_MANAGER_ABI, signer);
}

// Copia o endereço completo do usuário para a área de transferência
function copiarEndereco() {
  const fullAddress = document.getElementById("copyAddress").getAttribute("data-address");
  navigator.clipboard.writeText(fullAddress);
}

// ================== CARREGAR REQUESTS ==================
// Busca todas as requests da blockchain e separa entre pendentes e concluídas
async function carregarRequests() {
  const total = await tco2Manager.requestCounter(); // Conta total de requests
  const pendingList = document.getElementById("pendingRequests");
  const historyList = document.getElementById("historyRequests");

  // Limpa as listas antes de preenchê-las novamente
  pendingList.innerHTML = "";
  historyList.innerHTML = "";

  // Loop pelas requests do ID 1 até o total
  for (let i = 1; i <= total; i++) {
    const req = await tco2Manager.requests(i);

    // Cria item de lista para cada request
    const li = document.createElement("li");
    const atk = ethers.utils.formatUnits(req.atkAmount, DECIMALS);
    li.textContent = `Request #${i} - ${atk} ATK`;
    li.onclick = () => abrirModal(req); // Ao clicar, abre o modal com detalhes

    // Classifica entre pendente ou histórico
    if (!req.processed) {
      pendingList.appendChild(li);
    } else {
      historyList.appendChild(li);
    }
  }
}

// ================== MODAL DE DETALHES ==================
// Abre o modal e preenche com os dados da request clicada
function abrirModal(req) {
  selectedRequestId = Number(req.requestId); // Armazena ID da request ativa

  // Preenche os campos do modal com dados da request
  document.getElementById("modalId").innerText = selectedRequestId;
  document.getElementById("modalQtd").innerText = ethers.utils.formatUnits(req.atkAmount, DECIMALS);
  document.getElementById("modalTCO2").innerText = ethers.utils.formatUnits(req.tco2Amount, DECIMALS);
  document.getElementById("modalRequester").innerText = req.client;

  // Define o status com base nos flags approved e processed
  const status = req.processed
    ? req.approved ? "Aprovada" : "Rejeitada"
    : "Pendente";
  document.getElementById("modalStatus").innerText = status;

  // Mostra ou esconde os botões de ação dependendo do status
  document.getElementById("modalActions").style.display = req.processed ? "none" : "flex";

  // Exibe o modal
  document.getElementById("modalRequest").classList.remove("hidden");
  document.getElementById("modalRequest").classList.add("show");
}

// Fecha o modal de detalhes
function fecharModal() {
  document.getElementById("modalRequest").classList.add("hidden");
  document.getElementById("modalRequest").classList.remove("show");
  selectedRequestId = null;
}

// ================== APROVAR REQUEST ==================
// Chama a função do contrato para aprovar a conversão
async function confirmarAprovacao() {
  try {
    const tx = await tco2Manager.approveConversion(selectedRequestId);
    await tx.wait(); // Aguarda a confirmação da transação
    fecharModal();
    await carregarRequests(); // Atualiza lista após aprovação
  } catch (err) {
    console.error(err);
    alert("Erro ao aprovar a conversão.");
  }
}

// ================== REJEITAR REQUEST ==================
// Solicita um código de rejeição e chama a função do contrato
async function confirmarRejeicao() {
  const codigo = prompt("Digite o código de rejeição:");
  if (!codigo || isNaN(codigo)) return alert("Código inválido.");

  try {
    const tx = await tco2Manager.rejectConversion(selectedRequestId, Number(codigo));
    await tx.wait(); // Aguarda a confirmação da transação
    fecharModal();
    await carregarRequests(); // Atualiza lista após rejeição
  } catch (err) {
    console.error(err);
    alert("Erro ao rejeitar a conversão.");
  }
}
