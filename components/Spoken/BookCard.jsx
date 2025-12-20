import { motion } from 'framer-motion';

export default function BookCard({ book, onClick }) {
  return (
    <motion.div 
      whileTap={{ scale: 0.96 }}
      onClick={() => onClick(book)}
      className="relative aspect-[3/4.2] rounded-[2rem] overflow-hidden shadow-lg border border-slate-100 cursor-pointer group"
    >
      <img src={book.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-5 flex flex-col justify-end">
         <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">{book.tag}</span>
         <h3 className="text-white font-bold text-sm leading-tight">{book.title}</h3>
      </div>
    </motion.div>
  );
}
