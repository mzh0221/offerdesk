import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Select(props: ComponentProps<'select'>) {
    return <span className="select-control">
        <select {...props}/>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true"/>
    </span>;
}
