import { motion } from 'framer-motion';

export default function SpokenBookCard({ book, onClick }) {
  return (
    <motion.div 
      whileTap={{ scale: 0.95 }}
      onClick={() => onClick(book)}
      className="relative aspect-[3/4.5] rounded-3xl overflow-hidden shadow-lg group cursor-pointer border border-white/10"
    >
      <img src={book.image} className="w-full h-full object-cover group-hover:scale-110 duration-700" alt="" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end">
         <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">{book.tag}</p>
         <h3 className="text-white font-bold text-sm leading-tight">{book.name}</h3>
      </div>
    </motion.div>
  );
}
