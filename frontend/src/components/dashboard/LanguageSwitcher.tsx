import { useLanguage } from "../../contexts/LanguageContext";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Globe } from "lucide-react";

const LanguageSwitcher = () => {
    const { currentLang, setLanguage } = useLanguage();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Globe className="h-4 w-4" />
                    <span className="uppercase">{currentLang}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLanguage('en')}>
                    English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('fr')}>
                    Français
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('ar')}>
                    العربية
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default LanguageSwitcher;
