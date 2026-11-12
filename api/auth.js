const { prisma, sign, hashPassword, checkPassword } = require('./_auth');
module.exports = async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.setHeader('Allow','POST,GET,OPTIONS');return res.status(204).end();}
 try {
  if(req.method==='POST') {
   const {username,password}=req.body||{};
   if(typeof username!=='string'||typeof password!=='string'||!username.trim()||password.length<8)
    return res.status(400).json({status:'error',message:'Informe usuário e senha com pelo menos 8 caracteres.'});
   let count=await prisma.user.count();
   if(count===0 && process.env.BOOTSTRAP_ADMIN_USERNAME && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    await prisma.user.create({data:{username:process.env.BOOTSTRAP_ADMIN_USERNAME.trim(),passwordHash:hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD),accessLevel:1}});
   }
   const user=await prisma.user.findUnique({where:{username:username.trim()}});
   if(!user||!user.active||!checkPassword(password,user.passwordHash))
    return res.status(401).json({status:'error',message:'Usuário ou senha inválidos.'});
   const token=sign({sub:user.id,exp:Date.now()+12*60*60*1000});
   return res.status(200).json({status:'success',token,user:{id:user.id,username:user.username,accessLevel:user.accessLevel}});
  }
  if(req.method==='GET') {
   const header=req.headers.authorization||'';
   const token=header.startsWith('Bearer ')?header.slice(7):'';
   const {verify}=require('./_auth');
   const payload=verify(token);
   if(!payload)return res.status(401).json({status:'error',message:'Sessão expirada.'});
   const user=await prisma.user.findUnique({where:{id:payload.sub},select:{id:true,username:true,accessLevel:true,active:true}});
   if(!user||!user.active)return res.status(401).json({status:'error',message:'Conta inativa.'});
   return res.status(200).json({status:'success',user});
  }
  res.setHeader('Allow','POST,GET,OPTIONS');return res.status(405).end();
 } catch(e){console.error('Auth error',e);return res.status(500).json({status:'error',message:'Falha na autenticação.'});}
};