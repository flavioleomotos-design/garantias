const { prisma, requireUser } = require('./_auth');
const DEFAULT_COLUMNS=['Status','Cód. Barras','Descrição','Fornecedor','Defeito','Quantidade','Imagem','Observação','Anotações'];
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.setHeader('Allow','GET,POST,DELETE,OPTIONS');return res.status(204).end();}
 const user=await requireUser(req,res,3);if(!user)return;
 try{
  if(req.method==='GET'){
   const tabs=await prisma.tab.findMany();const sheets={};
   if(!tabs.length)sheets.Garantias={columns:DEFAULT_COLUMNS,hiddenColumns:[],customColumns:[],rows:[]};
   else for(const tab of tabs)sheets[tab.name]={columns:tab.columns,hiddenColumns:tab.hiddenColumns,customColumns:tab.customColumns,rows:tab.rows};
   return res.status(200).json({status:'success',sheets});
  }
  if(req.method==='POST'){
   if(user.accessLevel>2)return res.status(403).json({status:'error',message:'Seu nível de acesso permite apenas visualizar.'});
   const {sheetName,columns,hiddenColumns,customColumns,rows}=req.body||{};
   if(typeof sheetName!=='string'||!sheetName.trim()||!Array.isArray(columns)||!Array.isArray(hiddenColumns)||!Array.isArray(customColumns)||!Array.isArray(rows))return res.status(400).json({status:'error',message:'Dados inválidos.'});
   const existing=await prisma.tab.findUnique({where:{name:sheetName.trim()}});
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
 }catch(e){if(e.code==='P2025')return res.status(404).json({status:'error',message:'Aba não encontrada.'});console.error(e);return res.status(500).json({status:'error',message:'Erro ao acessar o banco.'});}
};