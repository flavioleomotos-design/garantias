const { prisma, requireUser, hashPassword } = require('./_auth');
module.exports = async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.setHeader('Allow','GET,PUT,POST,DELETE,OPTIONS');return res.status(204).end();}
 const actor=await requireUser(req,res,1); if(!actor)return;
 try {
  if(req.method==='GET') {
   const [tabs,users]=await Promise.all([
    prisma.tab.findMany({orderBy:{name:'asc'}}),
    prisma.user.findMany({orderBy:{username:'asc'},select:{id:true,username:true,accessLevel:true,active:true,createdAt:true}})
   ]);
   return res.status(200).json({status:'success',tabs,users,currentUserId:actor.id});
  }
  if(req.method==='PUT') {
   const {sheetName,rowIndex,row,userId,accessLevel,active,password}=req.body||{};
   if(userId) {
    if(userId===actor.id && (accessLevel!==undefined||active!==undefined)) return res.status(403).json({status:'error',message:'Você não pode alterar seu próprio nível ou status.'});
    const data={};
    if(accessLevel!==undefined){if(![1,2,3].includes(Number(accessLevel)))return res.status(400).json({status:'error',message:'Nível inválido.'});data.accessLevel=Number(accessLevel);}
    if(active!==undefined)data.active=!!active;
    if(password!==undefined){if(typeof password!=='string'||password.length<8)return res.status(400).json({status:'error',message:'A senha deve ter ao menos 8 caracteres.'});data.passwordHash=hashPassword(password);}
    const user=await prisma.user.update({where:{id:userId},data,select:{id:true,username:true,accessLevel:true,active:true}});
    return res.status(200).json({status:'success',user});
   }
   if(typeof sheetName!=='string'||!Number.isInteger(rowIndex)||rowIndex<0||!Array.isArray(row))return res.status(400).json({status:'error',message:'Dados inválidos.'});
   const tab=await prisma.tab.findUnique({where:{name:sheetName}});if(!tab)return res.status(404).json({status:'error',message:'Aba não encontrada.'});
   const rows=Array.isArray(tab.rows)?[...tab.rows]:[];
   if(rowIndex>=rows.length||row.length!==tab.columns.length)return res.status(400).json({status:'error',message:'Registro inválido.'});
   rows[rowIndex]=row.map(v=>v==null?'':String(v));await prisma.tab.update({where:{name:sheetName},data:{rows}});
   return res.status(200).json({status:'success'});
  }
  if(req.method==='POST') {
   const {username,password,accessLevel}=req.body||{};
   if(typeof username!=='string'||!username.trim()||typeof password!=='string'||password.length<8)return res.status(400).json({status:'error',message:'Informe usuário e senha (mínimo 8 caracteres).'});
   const level=accessLevel===undefined?3:Number(accessLevel);
   if(![1,2,3].includes(level))return res.status(400).json({status:'error',message:'Nível inválido.'});
   const user=await prisma.user.create({data:{username:username.trim(),passwordHash:hashPassword(password),accessLevel:level},select:{id:true,username:true,accessLevel:true,active:true}});
   return res.status(201).json({status:'success',user});
  }
  if(req.method==='DELETE') {
   const {sheetName,rowIndex,userId}=req.body||{};
   if(userId) {
    if(userId===actor.id)return res.status(403).json({status:'error',message:'Você não pode excluir sua própria conta.'});
    await prisma.user.delete({where:{id:userId}});return res.status(200).json({status:'success'});
   }
   if(typeof sheetName!=='string'||!Number.isInteger(rowIndex)||rowIndex<0)return res.status(400).json({status:'error',message:'Registro inválido.'});
   const tab=await prisma.tab.findUnique({where:{name:sheetName}});if(!tab)return res.status(404).json({status:'error',message:'Aba não encontrada.'});
   const rows=Array.isArray(tab.rows)?[...tab.rows]:[];if(rowIndex>=rows.length)return res.status(404).json({status:'error',message:'Item não encontrado.'});
   rows.splice(rowIndex,1);await prisma.tab.update({where:{name:sheetName},data:{rows}});
   return res.status(200).json({status:'success'});
  }
  res.setHeader('Allow','GET,PUT,POST,DELETE,OPTIONS');return res.status(405).end();
 } catch(e){if(e.code==='P2002')return res.status(409).json({status:'error',message:'Este nome de usuário já existe.'});if(e.code==='P2025')return res.status(404).json({status:'error',message:'Registro não encontrado.'});console.error('Admin API error',e);return res.status(500).json({status:'error',message:'Falha na operação administrativa.'});}
};