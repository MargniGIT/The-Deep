import { 
    GiBoneKnife,
    GiWoodClub,
    GiRustySword,
    GiBroadsword,
    GiSkullMask,
    GiLeatherArmor,
    GiRoundShield,
    GiLegArmor,
    GiRat,
    GiBoneGnawer,
    GiMetalBar,
    GiTwoCoins,
    GiLockedChest,
    GiSaphir,
    GiHealthPotion
  } from "react-icons/gi";
  import { CircleHelp } from "lucide-react";
  
  interface ItemIconProps {
    slug: string | null;
    className?: string;
  }
  
  // The Dictionary: Database Slug -> Icon Component
  const ICON_MAP: Record<string, React.ElementType> = {
    // Weapons
    'rusty-shiv': GiBoneKnife,
    'club': GiWoodClub,
    'sword': GiRustySword,
    'iron-gladius': GiBroadsword,
    
    // Armor
    'skull': GiSkullMask,
    'vest': GiLeatherArmor,
    'shield': GiRoundShield,
    'boots': GiLegArmor,
    
    // Materials / Junk
    'tail': GiRat,
    'bone': GiBoneGnawer,
    'scrap-metal': GiMetalBar,
    'coin': GiTwoCoins,
    'box': GiLockedChest,
    'gem': GiSaphir,
    'potion': GiHealthPotion,
  };
  
  export default function ItemIcon({ slug, className }: ItemIconProps) {
    const IconComponent = ICON_MAP[slug || ''] || CircleHelp;
    
    return <IconComponent className={className} />;
  }