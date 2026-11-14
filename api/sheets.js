const { prisma, requireUser } = require('./_auth');
const DEFAULT_COLUMNS=['Status','Cód. Barras','Descrição','Fornecedor','Defeito','Quantidade','Imagem','Observação','Anotações'];
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.setHeader('Allow','GET,POST,DELETE,OPTIONS');return res.status(204).end();}
 try{
  const user=await requireUser(req,res,3);if(!user)return;
  if(req.method==='GET'){
   const tabs=await prisma.tab.findMany();const sheets={};
   if(!tabs.length)sheets.Garantias={columns:DEFAULT_COLUMNS,hiddenColumns:[],customColumns:[],rows:[]};
   else for(const tab of tabs)sheets[tab.name]={columns:tab.columns,hiddenColumns:tab.hiddenColumns,customColumns:tab.customColumns,rows:tab.rows};
   return res.status(200).json({status:'success',sheets});
  }
  if(req.method==='POST'){
   const {sheetName,columns,hiddenColumns,customColumns,rows}=req.body||{};
   if(typeof sheetName!=='string'||!sheetName.trim()||!Array.isArray(columns)||!Array.isArray(hiddenColumns)||!Array.isArray(customColumns)||!Array.isArray(rows))return res.status(400).json({status:'error',message:'Dados inválidos.'});
   const existing=await prisma.tab.findUnique({where:{name:sheetName.trim()}});
   // Nível 3 pode alterar somente campos de itens já finalizados, sem mudar status,
   // estrutura da aba ou quantidade/ordem dos registros.
   if(user.accessLevel<=2 && existing){
    const statusIndex=existing.columns.indexOf('Status');
    if(statusIndex>=0){
     for(let i=0;i<Math.min(existing.rows.length,rows.length);i++){
      const before=existing.rows[i]||[];const after=rows[i]||[];
      const wasFinalized=String(before[statusIndex]??'').trim().toLowerCase()==='finalizado';
      if(wasFinalized&&JSON.stringify(before)!==JSON.stringify(after))return res.status(403).json({status:'error',message:'Itens finalizados só podem ser editados por usuários de nível 3.'});
     }
    }
   }
   if(user.accessLevel===3){
    if(!existing)return res.status(403).json({status:'error',message:'Usuários de nível 3 não podem criar abas.'});
    if(JSON.stringify(existing.columns)!==JSON.stringify(columns)||JSON.stringify(existing.hiddenColumns)!==JSON.stringify(hiddenColumns)||JSON.stringify(existing.customColumns)!==JSON.stringify(customColumns))return res.status(403).json({status:'error',message:'Usuários de nível 3 não podem alterar a estrutura das abas.'});
    if(!Array.isArray(existing.rows)||existing.rows.length!==rows.length)return res.status(403).json({status:'error',message:'Usuários de nível 3 não podem adicionar ou excluir itens.'});
    const statusIndex=existing.columns.indexOf('Status');
    for(let i=0;i<rows.length;i++){
     const before=existing.rows[i]||[];const after=rows[i]||[];
     if(JSON.stringify(before)!==JSON.stringify(after)){
      const wasFinalized=statusIndex>=0&&String(before[statusIndex]??'').trim().toLowerCase()==='finalizado';
      const statusUnchanged=statusIndex>=0&&String(after[statusIndex]??'').trim().toLowerCase()==='finalizado'&&String(before[statusIndex]??'').trim().toLowerCase()==='finalizado';
      if(!wasFinalized||!statusUnchanged)return res.status(403).json({status:'error',message:'Usuários de nível 3 só podem editar dados de itens finalizados.'});
     }
    }
   } else if(user.accessLevel>2){
    return res.status(403).json({status:'error',message:'Seu nível de acesso permite apenas visualizar itens finalizados.'});
   }
   if(user.accessLevel===2 && existing && (JSON.stringify(existing.columns)!==JSON.stringify(columns)||JSON.stringify(existing.hiddenColumns)!==JSON.stringify(hiddenColumns)||JSON.stringify(existing.customColumns)!==JSON.stringify(customColumns)))return res.status(403).json({status:'error',message:'Somente nível 1 pode alterar a estrutura das abas.'});
   if(user.accessLevel===2 && !existing)return res.status(403).json({status:'error',message:'Somente nível 1 pode criar abas.'});
   await prisma.tab.upsert({where:{name:sheetName.trim()},update:{columns,hiddenColumns,customColumns,rows},create:{name:sheetName.trim(),columns,hiddenColumns,customColumns,rows}});
   return res.status(200).json({status:'success'});
  }
  if(req.method==='DELETE'){
   if(user.accessLevel!==1)return res.status(403).json({status:'error',message:'Somente nível 1 pode excluir abas.'});
   const {sheetName}=req.body||{};if(typeof sheetName!=='string'||!sheetName.trim())return res.status(400).json({status:'error',message:'Nome inválido.'});
   await prisma.tab.delete({where:{name:sheetName.trim()}});return res.status(200).json({status:'success'});
  }
  res.setHeader('Allow','GET,POST,DELETE,OPTIONS');return res.status(405).end();
 }catch(e){
  console.error('[sheets] Falha na operação do banco:', e.code || e.name);
  if(e.code==='P2025')return res.status(404).json({status:'error',message:'Aba não encontrada.'});
  const connectionCodes=['P1000','P1001','P1002','P1017','P2024'];
  if(connectionCodes.includes(e.code))return res.status(503).json({status:'error',code:e.code,message:'Não foi possível conectar ao banco de dados. Verifique a conexão PostgreSQL.'});
  return res.status(500).json({status:'error',code:e.code || 'DATABASE_ERROR',message:'Erro ao acessar o banco de dados.'});
 }
};